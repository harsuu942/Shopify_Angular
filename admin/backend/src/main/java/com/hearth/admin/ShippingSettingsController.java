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

  ShippingSettingsController(CmsContentRepository repository, @Value("${app.shopify-api-url}") String storefrontUrl) {
    this.repository = repository;
    var factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(3000);
    factory.setReadTimeout(8000);
    storefront = RestClient.builder().baseUrl(storefrontUrl).requestFactory(factory).build();
  }

  public record Rates(@NotNull @Min(0) @Max(1000000) Long standardMinor,
                      @NotNull @Min(0) @Max(100000000) Long freeFromMinor,
                      @Min(0) @Max(100000000) long minimumMinor,
                      @Size(max=100) java.util.List<@NotBlank @Pattern(regexp="[A-Z]{1,2}[0-9][A-Z0-9]?(?:[0-9][A-Z]{2})?") String> excludedPostcodes) {
    public Rates {
      excludedPostcodes = excludedPostcodes == null ? java.util.List.of() : excludedPostcodes;
    }
  }

  @GetMapping
  public Rates get() {
    return repository.findBySlugAndStatus(SLUG, "PUBLISHED")
      .map(content -> mapper.readValue(content.body, Rates.class))
      .orElse(new Rates(2499L, 50000L, 0, java.util.List.of()));
  }

  @GetMapping("/preview")
  @PreAuthorize("hasRole('ADMIN')")
  public java.util.Map<String, Object> preview(@RequestParam("postcode") String postcode,
      @RequestParam("subtotalMinor") long subtotalMinor) {
    if (postcode.length() > 12 || subtotalMinor < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid preview inputs.");
    try {
      storefront.get().uri(builder -> builder.path("/api/checkout/delivery-availability")
        .queryParam("postcode", "{postcode}").build(postcode)).retrieve().toBodilessEntity();
    } catch (RestClientResponseException e) {
      if (e.getStatusCode().value() == 400) return java.util.Map.of("eligible", false);
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery preview is unavailable.");
    } catch (org.springframework.web.client.RestClientException e) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Delivery preview is unavailable.");
    }
    Rates rates = get();
    if (subtotalMinor < rates.minimumMinor()) {
      return java.util.Map.of("eligible", false, "minimumMinor", rates.minimumMinor());
    }
    return java.util.Map.of("eligible", true, "chargeMinor",
      subtotalMinor >= rates.freeFromMinor() ? 0 : rates.standardMinor());
  }

  @PutMapping
  @PreAuthorize("hasRole('ADMIN')")
  public Rates save(@Valid @RequestBody Rates rates) {
    var content = repository.findBySlugAndStatus(SLUG, "PUBLISHED").orElseGet(CmsContent::new);
    content.slug = SLUG;
    content.title = "Shipping rates";
    content.type = "SETTINGS";
    content.status = "PUBLISHED";
    content.publishedAt = Instant.now();
    content.body = mapper.writeValueAsString(rates);
    repository.save(content);
    return rates;
  }
}
