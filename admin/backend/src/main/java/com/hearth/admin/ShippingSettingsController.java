package com.hearth.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;

@RestController
@RequestMapping("/api/settings/shipping")
public class ShippingSettingsController {
  private static final String SLUG = "shipping-settings";
  private final CmsContentRepository repository;
  private final JsonMapper mapper = new JsonMapper();
  private final RestClient storefront;
  private final AuditService audit;

  ShippingSettingsController(CmsContentRepository repository, @Value("${app.shopify-api-url}") String storefrontUrl,
      AuditService audit) {
    this.repository = repository;
    this.audit = audit;
    var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(3000);
    factory.setReadTimeout(8000);
    storefront = RestClient.builder().baseUrl(storefrontUrl).requestFactory(factory).build();
  }

  public record Rates(@NotNull @Min(0) @Max(1000000) Long standardMinor,
                      @NotNull @Min(0) @Max(100000000) Long freeFromMinor,
                      @Min(0) @Max(100000000) long minimumMinor,
                      @Size(max=100) java.util.List<@NotBlank @Pattern(regexp="[A-Z]{1,2}[0-9][A-Z0-9]?(?:[0-9][A-Z]{2})?") String> excludedPostcodes,
                      @Valid WeightPolicy weightPolicy) {
    public Rates {
      excludedPostcodes = excludedPostcodes == null ? java.util.List.of() : excludedPostcodes;
    }
  }

  public record Bracket(@NotNull @Positive java.math.BigDecimal upToKg, @Min(0) @Max(1000000) long chargeMinor) {}
  public record SupplierRule(@NotBlank @Size(max=100) String supplier,
    @NotBlank @Pattern(regexp="WEIGHT|FIXED|MINIMUM") String mode,
    @Min(0) @Max(1000000) long amountMinor, boolean active, boolean capExempt,
    boolean vatExclusive, @DecimalMin("0") @DecimalMax("100") java.math.BigDecimal vatPercent) {}
  public record WeightPolicy(@NotEmpty @Size(max=30) java.util.List<@NotNull @Valid Bracket> brackets,
    @Min(0) @Max(1000000) long overMaxMinor, @Min(0) @Max(1000000) long fallbackMinor,
    @Min(0) @Max(1000000) long capMinor, @Size(max=100) java.util.List<@NotNull @Valid SupplierRule> suppliers) {}

  @GetMapping
  public Rates get() {
    return repository.findBySlugAndStatus(SLUG, "PUBLISHED")
      .map(content -> mapper.readValue(content.body, Rates.class))
      .orElse(new Rates(2499L, 50000L, 0, java.util.List.of(), null));
  }

  @GetMapping("/preview")
  @PreAuthorize("hasRole('ADMIN')")
  public java.util.Map<String, Object> preview(@RequestParam("postcode") String postcode,
      @RequestParam("subtotalMinor") long subtotalMinor,
      @RequestParam(value="weightKg", required=false) java.math.BigDecimal weightKg,
      @RequestParam(value="suppliers", defaultValue="") String suppliers) {
    if (postcode.length() > 12 || subtotalMinor < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid preview inputs.");
    try {
      return storefront.get().uri(builder -> {
        builder.path("/api/checkout/shipping-preview").queryParam("postcode", "{postcode}")
          .queryParam("subtotalMinor", subtotalMinor).queryParam("suppliers", "{suppliers}");
        if (weightKg != null) builder.queryParam("weightKg", weightKg.toPlainString());
        return builder.build(java.util.Map.of("postcode", postcode, "suppliers", suppliers));
      }).retrieve().body(new org.springframework.core.ParameterizedTypeReference<java.util.Map<String, Object>>() {});
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 400) return java.util.Map.of("eligible", false);
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery preview is unavailable.");
    } catch (org.springframework.web.client.RestClientException e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery preview is unavailable.");
    }
  }

  @PutMapping
  @PreAuthorize("hasRole('ADMIN')")
  @org.springframework.transaction.annotation.Transactional
  public Rates save(@Valid @RequestBody Rates rates, org.springframework.security.core.Authentication actor,
      jakarta.servlet.http.HttpServletRequest request) {
    if (rates.weightPolicy() != null) {
      var previous = java.math.BigDecimal.ZERO;
      for (var bracket : rates.weightPolicy().brackets()) {
        if (bracket.upToKg().compareTo(previous) <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weight limits must be strictly increasing.");
        previous = bracket.upToKg();
      }
      var names = new java.util.HashSet<String>();
      if (rates.weightPolicy().suppliers() == null || rates.weightPolicy().suppliers().stream()
          .anyMatch(rule -> !names.add(rule.supplier().strip().toLowerCase(java.util.Locale.ROOT)))) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Supplier names must be unique.");
      }
      if (rates.weightPolicy().suppliers().stream().anyMatch(rule -> rule.vatExclusive() && rule.vatPercent() == null)) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the VAT percentage for each VAT-exclusive charge.");
      }
    }
    var content = repository.findBySlugAndStatus(SLUG, "PUBLISHED").orElseGet(CmsContent::new);
    content.slug = SLUG;
    content.title = "Shipping rates";
    content.type = "SETTINGS";
    content.status = "PUBLISHED";
    content.publishedAt = Instant.now();
    content.body = mapper.writeValueAsString(rates);
    repository.save(content);
    audit.log(actor, "UPDATE", "SHIPPING_SETTINGS", content.id, "Updated checkout delivery rules", request);
    return rates;
  }
}
