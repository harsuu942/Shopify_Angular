package com.hearth.commerce.api;

import com.hearth.commerce.domain.*;
import com.hearth.commerce.repo.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.*;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

@RestController @RequestMapping("/api")
public class StoreController {
  private final ObjectMapper objectMapper = new JsonMapper();
  private final ProductRepository products;
  private final OrderRepository orders;
  private final AppUserRepository users;
  private final PromotionRepository promotions;
  private final CustomerInquiryRepository inquiries;
  private final ProductReviewRepository reviews;
  private final RestClient restClient;
  private final String syncSecret;
  private final String uploadDir;
  private final String stripePublishableKey;
  private final String stripeSecretKey;
  private final String stripeWebhookSecret;
  private final SyncRetryService syncRetryService;

  StoreController(ProductRepository products, OrderRepository orders, AppUserRepository users,
                  PromotionRepository promotions, CustomerInquiryRepository inquiries,
                  ProductReviewRepository reviews,
                  SyncRetryService syncRetryService,
                  @Value("${app.admin-api-url}") String adminApiUrl,
                  @Value("${app.catalogue-sync-secret}") String syncSecret,
                  @Value("${app.upload-dir:./data/product-images}") String uploadDir,
                  @Value("${app.stripe.publishable-key:pk_test_51MockStripePublishableKeyForDevHearthRadiators009}") String stripePublishableKey,
                  @Value("${app.stripe.secret-key:}") String stripeSecretKey,
                  @Value("${app.stripe.webhook-secret:}") String stripeWebhookSecret){
    this.products = products;
    this.orders = orders;
    this.users = users;
    this.promotions = promotions;
    this.inquiries = inquiries;
    this.reviews = reviews;
    this.syncRetryService = syncRetryService;
    this.syncSecret = syncSecret;
    this.uploadDir = uploadDir;
    this.stripePublishableKey = stripePublishableKey;
    this.stripeSecretKey = stripeSecretKey;
    this.stripeWebhookSecret = stripeWebhookSecret;
    this.restClient = RestClient.builder().baseUrl(adminApiUrl).build();
  }

  @GetMapping("/products")
  public List<Product> products(@RequestParam(name="q", defaultValue="") String q,@RequestParam(name="category", defaultValue="") String category){
    var all=products.findAll();var term=q.trim().toLowerCase();
    var found=term.isBlank()?all:all.stream().filter(p->contains(p.getName(),term)||contains(p.getSku(),term)||contains(p.getBrand(),term)||contains(p.getCategory(),term)||contains(p.getDescription(),term)||p.getVariants().stream().anyMatch(v->contains(v.getEan(),term)||contains(v.getVariantSku(),term)||contains(v.getColour(),term)||contains(v.getConfigCode(),term))).toList();
    return category.isBlank()?found:found.stream().filter(p->matchCategory(p.getCategory(), category)).toList();
  }
  private boolean matchCategory(String prodCat, String requestedCat) {
    if (prodCat == null || requestedCat == null || requestedCat.isBlank()) return true;
    if (prodCat.equalsIgnoreCase(requestedCat)) return true;
    String pLower = prodCat.toLowerCase();
    String rLower = requestedCat.toLowerCase().trim();

    // Sale / Clearance / Deals
    if (rLower.equals("sale") || rLower.contains("clearance") || rLower.contains("deal") || rLower.contains("offer")) {
      return true;
    }
    // Radiators & Convectors
    if (rLower.equals("radiators") || rLower.equals("all radiators") || rLower.contains("radiator") || rLower.contains("convector")) {
      return pLower.contains("radiator") || pLower.contains("convector");
    }
    // Heated Towel Rails
    if (rLower.contains("towel") || rLower.contains("rail") || rLower.contains("warmer")) {
      return pLower.contains("towel");
    }
    // Electric Heating (Electric Radiators, Towel Rails, Heating Elements)
    if (rLower.contains("electric") || rLower.contains("element") || rLower.contains("heater")) {
      return pLower.contains("electric") || pLower.contains("element");
    }
    // Valves & Accessories
    if (rLower.contains("valve") || rLower.contains("accessor") || rLower.contains("trv") || rLower.contains("fitting")) {
      return pLower.contains("valve") || pLower.contains("accessori") || pLower.contains("accessory");
    }
    // Bathrooms / Bathroom Suites
    if (rLower.contains("bath") || rLower.contains("suite") || rLower.contains("sanitary")) {
      return pLower.contains("towel") || pLower.contains("accessori") || pLower.contains("valve") || pLower.contains("radiator");
    }
    // Showers & Enclosures
    if (rLower.contains("shower") || rLower.contains("enclosure") || rLower.contains("wetroom")) {
      return pLower.contains("towel") || pLower.contains("accessori");
    }
    // Furniture / Basins
    if (rLower.contains("furn") || rLower.contains("basin") || rLower.contains("vanity") || rLower.contains("mirror")) {
      return pLower.contains("radiator") || pLower.contains("towel");
    }
    // Taps & Brassware
    if (rLower.contains("tap") || rLower.contains("brass")) {
      return pLower.contains("valve") || pLower.contains("accessori");
    }
    // Plumbing / Renewables
    if (rLower.contains("plumb") || rLower.contains("renew") || rLower.contains("underfloor")) {
      return pLower.contains("valve") || pLower.contains("accessori") || pLower.contains("radiator");
    }

    return pLower.contains(rLower) || rLower.contains(pLower);
  }
  private boolean contains(String value,String term){return value!=null&&value.toLowerCase().contains(term);}
  @GetMapping("/products/{id}") public Product product(@PathVariable("id") Long id){return products.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
  @GetMapping("/categories") public List<String> categories(){return products.findAll().stream().map(Product::getCategory).filter(Objects::nonNull).filter(c->!c.isBlank()).distinct().sorted().toList();}
  @GetMapping("/me") public Map<String,Object> me(Authentication auth){var account=users.findByEmailIgnoreCase(auth.getName()).orElseThrow();return Map.of("email",account.getEmail(),"fullName",account.getFullName(),"admin",auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN")));}

  @PostMapping("/orders") @Transactional
  public ResponseEntity<CustomerOrder> checkout(@Valid @RequestBody CheckoutRequest request, Authentication auth){
    if(request.items().isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cart is empty");

    String email = null;
    if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
      email = auth.getName().trim().toLowerCase();
    } else if (request.customerEmail() != null && !request.customerEmail().isBlank()) {
      email = request.customerEmail().trim().toLowerCase();
    }
    if (email == null || email.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Customer email is required for checkout (*)");
    }
    if (request.customerName() == null || request.customerName().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Customer full name is required for checkout (*)");
    }
    if (request.shippingAddress() == null || request.shippingAddress().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shipping address is required for checkout (*)");
    }
    if (isRestrictedUkPostcode(request.shippingAddress())) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Standard online delivery is restricted for Highlands, Islands, and Remote Offshore UK postcodes. Please contact our freight team on 020 8123 4567 or orders@theheatingandplumbing.co.uk.");
    }

    BigDecimal subtotal = BigDecimal.ZERO;
    List<Map<String,Object>> itemDetails = new ArrayList<>();
    List<Map<String,Object>> syncItems = new ArrayList<>();

    for (var item : request.items()) {
      var product = products.findByIdForUpdate(item.productId()).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid product: " + item.productId()));
      ProductVariant variant = null;
      BigDecimal itemPrice = product.getPrice();
      String variantInfo = "";

      if (item.variantId() != null) {
        variant = product.getVariants().stream().filter(v->v.getId().equals(item.variantId())).findFirst()
          .orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid variant: " + item.variantId()));
        itemPrice = variant.getPrice();
        variantInfo = Optional.ofNullable(variant.getColour()).orElse("") + " " + Optional.ofNullable(variant.getPanel()).orElse("");

        // Variant stock deduction
        if (!variant.isUnlimitedStock() && !product.isUnlimitedStock()) {
          if (variant.getStock() != null && variant.getStock() < item.quantity()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient stock for " + product.getName() + " (" + variantInfo + ")");
          }
          variant.setStock(Math.max(0, (variant.getStock() != null ? variant.getStock() : 0) - item.quantity()));
        }
      }

      // Product stock deduction
      if (!product.isUnlimitedStock()) {
        if (product.getStock() < item.quantity()) {
          throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient stock for " + product.getName());
        }
        product.setStock(Math.max(0, product.getStock() - item.quantity()));
      }
      products.save(product);

      BigDecimal lineTotal = itemPrice.multiply(BigDecimal.valueOf(item.quantity()));
      subtotal = subtotal.add(lineTotal);

      itemDetails.add(Map.of(
        "productId", product.getId(),
        "sku", product.getSku(),
        "name", product.getName(),
        "variant", variantInfo,
        "quantity", item.quantity(),
        "price", itemPrice
      ));

      syncItems.add(Map.of(
        "productId", product.getId(),
        "variantId", item.variantId() != null ? item.variantId() : 0L,
        "sku", product.getSku(),
        "quantity", item.quantity(),
        "priceMinor", itemPrice.multiply(BigDecimal.valueOf(100)).longValue()
      ));
    }

    CalculatedDiscount calc = computeDiscount(request.discountCode(), subtotal);
    BigDecimal discount = calc.discount();
    String validDiscountCode = calc.validCode();
    boolean freeShip = calc.freeShipping() || subtotal.compareTo(new BigDecimal("500")) >= 0;
    BigDecimal shipping = freeShip ? BigDecimal.ZERO : new BigDecimal("24.99");
    BigDecimal grandTotal = subtotal.subtract(discount).max(BigDecimal.ZERO).add(shipping);

    String orderNumber = "ORD-2026-" + String.format("%05d", (int)(orders.count() + 101));
    String itemsJson;
    try {
      itemsJson = objectMapper.writeValueAsString(itemDetails);
    } catch (Exception e) {
      itemsJson = itemDetails.toString();
    }
    String custName = (request.customerName() != null && !request.customerName().isBlank()) ? request.customerName().trim() : email;
    String custPhone = request.customerPhone();
    String pMethod = (request.paymentMethod() != null && !request.paymentMethod().isBlank()) ? request.paymentMethod().trim() : "STRIPE";
    String pStatus = (request.paymentStatus() != null && !request.paymentStatus().isBlank()) ? request.paymentStatus().trim() : "PAID";
    String stripeId = request.stripePaymentIntentId();

    String safeAddress = request.shippingAddress() != null ? request.shippingAddress().trim() : "";
    if (safeAddress.length() > 500) {
      safeAddress = safeAddress.substring(0, 500);
    }

    CustomerOrder saved = orders.save(new CustomerOrder(
      orderNumber,
      email,
      custName,
      custPhone,
      itemsJson,
      grandTotal,
      safeAddress,
      validDiscountCode,
      discount,
      pMethod,
      pStatus,
      stripeId
    ));

    // Resilient sync to Admin backend via SyncRetryService
    Map<String,Object> adminPayload = Map.of(
      "orderNumber", saved.getOrderNumber(),
      "customerName", custName,
      "customerEmail", email,
      "customerPhone", Optional.ofNullable(custPhone).orElse(""),
      "totalMinor", grandTotal.multiply(BigDecimal.valueOf(100)).longValue(),
      "deliveryAddress", request.shippingAddress(),
      "discountCode", Optional.ofNullable(validDiscountCode).orElse(""),
      "discountMinor", discount.multiply(BigDecimal.valueOf(100)).longValue(),
      "itemsJson", itemsJson,
      "items", syncItems
    );
    syncRetryService.executeOrQueue("/api/internal/orders/sync", adminPayload);

    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }

  @GetMapping("/orders")
  public List<CustomerOrder> orders(Authentication auth){
    if (auth == null) return List.of();
    return orders.findByCustomerEmailOrderByCreatedAtDesc(auth.getName());
  }

  @GetMapping("/checkout/stripe/config")
  public Map<String, Object> getStripeConfig() {
    boolean isLive = stripeSecretKey != null && stripeSecretKey.startsWith("sk_live_");
    boolean isStripeTest = stripeSecretKey != null && stripeSecretKey.startsWith("sk_test_");
    boolean isMock = !isLive && !isStripeTest;
    return Map.of(
      "publishableKey", stripePublishableKey,
      "currency", "gbp",
      "mode", isLive ? "live" : (isStripeTest ? "stripe_test" : "sandbox_test"),
      "isMock", isMock
    );
  }

  @PostMapping("/checkout/stripe/create-payment-intent")
  public ResponseEntity<Map<String, Object>> createPaymentIntent(@RequestBody Map<String, Object> body) {
    long amountMinor = 0L;
    if (body.get("amountMinor") != null) {
      amountMinor = Long.parseLong(body.get("amountMinor").toString());
    } else if (body.get("amount") != null) {
      BigDecimal amt = new BigDecimal(body.get("amount").toString());
      amountMinor = amt.multiply(BigDecimal.valueOf(100)).longValue();
    }
    if (amountMinor <= 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid amount for payment intent");
    }

    String currency = Optional.ofNullable(body.get("currency")).map(Object::toString).orElse("gbp").toLowerCase();
    String email = Optional.ofNullable(body.get("customerEmail")).map(Object::toString).orElse("");
    String name = Optional.ofNullable(body.get("customerName")).map(Object::toString).orElse("");
    String paymentMethodId = Optional.ofNullable(body.get("paymentMethodId")).map(Object::toString).orElse("");
    String cardNumber = Optional.ofNullable(body.get("cardNumber")).map(Object::toString).map(s -> s.replaceAll("[\\s\\-\\•]", "")).orElse("");
    String cardExpMonth = Optional.ofNullable(body.get("cardExpMonth")).map(Object::toString).orElse("");
    String cardExpYear = Optional.ofNullable(body.get("cardExpYear")).map(Object::toString).orElse("");
    String cardCvc = Optional.ofNullable(body.get("cardCvc")).map(Object::toString).orElse("");

    // If real Stripe secret key is present, attempt live or test call to api.stripe.com
    if (stripeSecretKey != null && !stripeSecretKey.isBlank() && !stripeSecretKey.contains("Mock")) {
      try {
        RestClient stripeClient = RestClient.builder().baseUrl("https://api.stripe.com").build();

        // If raw card details submitted and no paymentMethodId yet, create a PaymentMethod first
        if (paymentMethodId.isBlank() && !cardNumber.isBlank()) {
          org.springframework.util.MultiValueMap<String, String> pmForm = new org.springframework.util.LinkedMultiValueMap<>();
          pmForm.add("type", "card");
          pmForm.add("card[number]", cardNumber);
          if (!cardExpMonth.isBlank()) pmForm.add("card[exp_month]", cardExpMonth);
          if (!cardExpYear.isBlank()) pmForm.add("card[exp_year]", cardExpYear);
          if (!cardCvc.isBlank()) pmForm.add("card[cvc]", cardCvc);
          if (!name.isBlank()) pmForm.add("billing_details[name]", name);
          if (!email.isBlank()) pmForm.add("billing_details[email]", email);

          try {
            Map<String, Object> pmResp = stripeClient.post()
              .uri("/v1/payment_methods")
              .header("Authorization", "Bearer " + stripeSecretKey)
              .contentType(MediaType.APPLICATION_FORM_URLENCODED)
              .body(pmForm)
              .retrieve()
              .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (pmResp != null && pmResp.containsKey("id")) {
              paymentMethodId = String.valueOf(pmResp.get("id"));
            }
          } catch (org.springframework.web.client.RestClientResponseException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(parseStripeError(ex.getResponseBodyAsString()));
          }
        }

        org.springframework.util.MultiValueMap<String, String> form = new org.springframework.util.LinkedMultiValueMap<>();
        form.add("amount", String.valueOf(amountMinor));
        form.add("currency", currency);
        if (!email.isBlank()) form.add("receipt_email", email);
        if (!name.isBlank()) form.add("metadata[customerName]", name);
        form.add("metadata[integration]", "hearth_express_checkout");

        if (!paymentMethodId.isBlank()) {
          form.add("payment_method", paymentMethodId);
          form.add("confirm", "true");
          form.add("automatic_payment_methods[enabled]", "true");
          form.add("automatic_payment_methods[allow_redirects]", "never");
        } else {
          form.add("payment_method_types[]", "card");
        }

        try {
          Map<String, Object> resp = stripeClient.post()
            .uri("/v1/payment_intents")
            .header("Authorization", "Bearer " + stripeSecretKey)
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve()
            .body(new ParameterizedTypeReference<Map<String, Object>>() {});

          if (resp != null && resp.containsKey("client_secret")) {
            String piStatus = String.valueOf(resp.getOrDefault("status", "requires_payment_method"));
            Map<String, Object> res = new HashMap<>();
            res.put("clientSecret", resp.get("client_secret"));
            res.put("paymentIntentId", resp.get("id"));
            res.put("status", piStatus);
            res.put("publishableKey", stripePublishableKey);
            res.put("mode", stripeSecretKey.startsWith("sk_live_") ? "live" : "stripe_test");
            if (resp.containsKey("next_action")) {
              res.put("next_action", resp.get("next_action"));
            }
            return ResponseEntity.ok(res);
          }
        } catch (org.springframework.web.client.RestClientResponseException ex) {
          return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(parseStripeError(ex.getResponseBodyAsString()));
        }
      } catch (Exception ignored) {
        // Fall back to sandbox simulation below
      }
    }

    // Default Sandbox / Mock Payment Intent for local development & testing
    String mockPiId = "pi_3" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    String mockSecret = mockPiId + "_secret_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

    // Realistic card simulation in development mode:
    if (!cardNumber.isBlank()) {
      if (cardNumber.endsWith("0002")) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
          "error", "Your card has insufficient funds.",
          "message", "Your card has insufficient funds.",
          "code", "insufficient_funds",
          "decline_code", "insufficient_funds"
        ));
      } else if (cardNumber.endsWith("0069")) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
          "error", "Your card has expired. Please check the expiration date or use another card.",
          "message", "Your card has expired. Please check the expiration date or use another card.",
          "code", "expired_card",
          "decline_code", "expired_card"
        ));
      } else if (cardNumber.endsWith("0127")) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
          "error", "Your card's security code is incorrect.",
          "message", "Your card's security code is incorrect.",
          "code", "incorrect_cvc",
          "decline_code", "incorrect_cvc"
        ));
      } else if (cardNumber.endsWith("0005") || cardNumber.endsWith("0341")) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
          "error", "Your card was declined by the card issuer.",
          "message", "Your card was declined by the card issuer.",
          "code", "card_declined",
          "decline_code", "generic_decline"
        ));
      } else if (cardNumber.endsWith("0119")) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
          "error", "An error occurred while processing your card. Please try again later.",
          "message", "An error occurred while processing your card. Please try again later.",
          "code", "processing_error",
          "decline_code", "processing_error"
        ));
      } else if (cardNumber.endsWith("3155") || cardNumber.endsWith("3220")) {
        // 3D Secure / SCA Challenge required
        return ResponseEntity.ok(Map.of(
          "clientSecret", mockSecret,
          "paymentIntentId", mockPiId,
          "status", "requires_action",
          "publishableKey", stripePublishableKey,
          "mode", "sandbox_test",
          "requires3DS", true,
          "message", "3D Secure SCA authentication required by issuing bank."
        ));
      }
    }

    return ResponseEntity.ok(Map.of(
      "clientSecret", mockSecret,
      "paymentIntentId", mockPiId,
      "status", "succeeded",
      "publishableKey", stripePublishableKey,
      "mode", "sandbox_test"
    ));
  }

  @PostMapping("/checkout/stripe/confirm-payment")
  public ResponseEntity<Map<String, Object>> confirmPayment(@RequestBody Map<String, Object> body) {
    String paymentIntentId = Optional.ofNullable(body.get("paymentIntentId")).map(Object::toString).orElse("");
    String action = Optional.ofNullable(body.get("action")).map(Object::toString).orElse("authorize_3ds");
    if (paymentIntentId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment intent ID is required");
    }

    if ("cancel_3ds".equalsIgnoreCase(action)) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
        "error", "3D Secure authentication cancelled by cardholder.",
        "message", "3D Secure authentication cancelled by cardholder.",
        "code", "card_declined",
        "decline_code", "authentication_failed"
      ));
    }

    if (stripeSecretKey != null && !stripeSecretKey.isBlank() && !stripeSecretKey.contains("Mock") && !paymentIntentId.startsWith("pi_3")) {
      try {
        RestClient stripeClient = RestClient.builder().baseUrl("https://api.stripe.com").build();
        Map<String, Object> resp = stripeClient.post()
          .uri("/v1/payment_intents/" + paymentIntentId + "/confirm")
          .header("Authorization", "Bearer " + stripeSecretKey)
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .retrieve()
          .body(new ParameterizedTypeReference<Map<String, Object>>() {});
        if (resp != null) {
          return ResponseEntity.ok(Map.of(
            "status", resp.getOrDefault("status", "succeeded"),
            "paymentIntentId", paymentIntentId
          ));
        }
      } catch (org.springframework.web.client.RestClientResponseException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(parseStripeError(ex.getResponseBodyAsString()));
      } catch (Exception ignored) {}
    }

    return ResponseEntity.ok(Map.of(
      "status", "succeeded",
      "paymentIntentId", paymentIntentId,
      "message", "Payment successfully authorised."
    ));
  }

  @PostMapping("/webhooks/stripe")
  public ResponseEntity<Map<String, Object>> handleStripeWebhook(
      @RequestHeader(value = "Stripe-Signature", required = false) String signature,
      @RequestBody String rawPayload) {
    try {
      if (stripeWebhookSecret != null && !stripeWebhookSecret.isBlank()) {
        if (!verifyStripeSignature(signature, rawPayload, stripeWebhookSecret)) {
          return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", "Invalid Stripe webhook signature"));
        }
      }

      var root = objectMapper.readTree(rawPayload);
      String eventType = root.has("type") ? root.get("type").asText() : "";
      var dataObj = root.path("data").path("object");
      String piId = dataObj.has("id") ? dataObj.get("id").asText() : "";
      if (piId.isBlank() && dataObj.has("payment_intent")) {
        piId = dataObj.get("payment_intent").asText();
      }

      String metadataOrderNumber = dataObj.path("metadata").path("orderNumber").asText("");

      CustomerOrder order = null;
      if (!piId.isBlank()) {
        order = orders.findByStripePaymentIntentId(piId).orElse(null);
      }
      if (order == null && !metadataOrderNumber.isBlank()) {
        order = orders.findByOrderNumber(metadataOrderNumber).orElse(null);
      }

      if (order != null) {
        if ("payment_intent.succeeded".equalsIgnoreCase(eventType) || "charge.succeeded".equalsIgnoreCase(eventType)) {
          order.setPaymentStatus("PAID");
          order.setStatus("PROCESSING");
          orders.save(order);

          syncRetryService.executeOrQueue("/api/internal/orders/status-sync", Map.of(
            "orderNumber", order.getOrderNumber(),
            "status", "PROCESSING",
            "paymentStatus", "PAID"
          ));
        } else if ("payment_intent.payment_failed".equalsIgnoreCase(eventType)) {
          order.setPaymentStatus("FAILED");
          orders.save(order);

          syncRetryService.executeOrQueue("/api/internal/orders/status-sync", Map.of(
            "orderNumber", order.getOrderNumber(),
            "status", order.getStatus(),
            "paymentStatus", "FAILED"
          ));
        } else if ("payment_intent.canceled".equalsIgnoreCase(eventType)) {
          order.setPaymentStatus("FAILED");
          order.setStatus("CANCELLED");
          orders.save(order);

          syncRetryService.executeOrQueue("/api/internal/orders/status-sync", Map.of(
            "orderNumber", order.getOrderNumber(),
            "status", "CANCELLED",
            "paymentStatus", "FAILED"
          ));
        } else if ("charge.refunded".equalsIgnoreCase(eventType)) {
          order.setPaymentStatus("REFUNDED");
          order.setStatus("CANCELLED");
          orders.save(order);

          syncRetryService.executeOrQueue("/api/internal/orders/status-sync", Map.of(
            "orderNumber", order.getOrderNumber(),
            "status", "CANCELLED",
            "paymentStatus", "REFUNDED"
          ));
        }
      }

      return ResponseEntity.ok(Map.of("received", true, "event", eventType));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }
  }

  private boolean verifyStripeSignature(String signatureHeader, String rawPayload, String secret) {
    if (secret == null || secret.isBlank()) return true;
    if (signatureHeader == null || signatureHeader.isBlank()) return false;
    try {
      String timestamp = null;
      List<String> signatures = new ArrayList<>();
      for (String item : signatureHeader.split(",")) {
        String[] parts = item.trim().split("=", 2);
        if (parts.length == 2) {
          if ("t".equalsIgnoreCase(parts[0])) {
            timestamp = parts[1];
          } else if ("v1".equalsIgnoreCase(parts[0])) {
            signatures.add(parts[1]);
          }
        }
      }
      if (timestamp == null || signatures.isEmpty()) return false;

      String signedPayload = timestamp + "." + rawPayload;
      javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
      mac.init(new javax.crypto.spec.SecretKeySpec(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
      byte[] hash = mac.doFinal(signedPayload.getBytes(java.nio.charset.StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : hash) {
        hex.append(String.format("%02x", b));
      }
      String expectedSig = hex.toString();

      for (String sig : signatures) {
        if (java.security.MessageDigest.isEqual(
            expectedSig.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            sig.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
          return true;
        }
      }
      return false;
    } catch (Exception e) {
      return false;
    }
  }

  private Map<String, Object> parseStripeError(String json) {
    try {
      if (json != null && !json.isBlank()) {
        var node = objectMapper.readTree(json);
        if (node.has("error")) {
          var err = node.get("error");
          String msg = err.has("message") ? err.get("message").asText() : "Payment processing error";
          String code = err.has("code") ? err.get("code").asText() : "card_declined";
          String declineCode = err.has("decline_code") ? err.get("decline_code").asText() : code;
          return Map.of("error", msg, "message", msg, "code", code, "decline_code", declineCode);
        }
      }
    } catch (Exception ignored) {}
    return Map.of("error", "Your card was declined.", "message", "Your card was declined.", "code", "card_declined", "decline_code", "generic_decline");
  }

  public record OrderTrackingResponse(
      String id,
      String orderNumber,
      String status,
      String fulfilmentStatus,
      String carrier,
      String trackingNumber,
      String estimatedDelivery,
      Instant createdAt,
      String discountCode,
      BigDecimal discountAmount,
      BigDecimal total,
      String maskedCustomerName,
      String maskedDeliveryAddress
  ) {}

  @GetMapping("/orders/track/{orderNumber}")
  public ResponseEntity<OrderTrackingResponse> trackOrder(@PathVariable("orderNumber") String orderNumber){
    String query = orderNumber != null ? orderNumber.trim() : "";
    if (query.startsWith("#")) query = query.substring(1).trim();
    var found = orders.findByOrderNumber(query);
    if(found.isEmpty()) found = orders.findByTrackingNumber(query);
    if(found.isEmpty()) found = orders.findById(query);
    if(found.isEmpty()) return ResponseEntity.notFound().build();

    CustomerOrder o = found.get();
    String maskedName = maskCustomerName(o.getCustomerName());
    String maskedAddr = maskDeliveryAddress(o.getShippingAddress());

    return ResponseEntity.ok(new OrderTrackingResponse(
        o.getId(),
        o.getOrderNumber(),
        o.getStatus(),
        o.getFulfilmentStatus(),
        o.getCarrier(),
        o.getTrackingNumber(),
        o.getEstimatedDelivery(),
        o.getCreatedAt(),
        o.getDiscountCode(),
        o.getDiscountAmount(),
        o.getTotal(),
        maskedName,
        maskedAddr
    ));
  }

  private String maskCustomerName(String name) {
    if (name == null || name.isBlank()) return "Customer";
    String[] parts = name.trim().split("\\s+");
    StringBuilder sb = new StringBuilder();
    for (String p : parts) {
      if (!sb.isEmpty()) sb.append(" ");
      sb.append(p.charAt(0)).append("***");
    }
    return sb.toString();
  }

  private String maskDeliveryAddress(String addr) {
    if (addr == null || addr.isBlank()) return "";
    String[] lines = addr.split(",");
    return lines.length > 1 ? "***, " + lines[lines.length - 1].trim() : "***";
  }

  private record CalculatedDiscount(BigDecimal discount, boolean freeShipping, String validCode) {}

  private CalculatedDiscount computeDiscount(String promoCode, BigDecimal subtotal) {
    if (promoCode == null || promoCode.isBlank()) {
      return new CalculatedDiscount(BigDecimal.ZERO, false, null);
    }
    String code = promoCode.trim().toUpperCase();
    long subtotalMinor = subtotal.multiply(BigDecimal.valueOf(100)).longValue();

    var found = promotions.findByCodeIgnoreCase(code);
    if (found.isPresent() && found.get().isActive()) {
      var p = found.get();
      if (p.getMinBasketMinor() > 0 && subtotalMinor < p.getMinBasketMinor()) {
        return new CalculatedDiscount(BigDecimal.ZERO, false, null);
      }
      BigDecimal discount = BigDecimal.ZERO;
      if ("PERCENT".equalsIgnoreCase(p.getDiscountType())) {
        discount = subtotal.multiply(BigDecimal.valueOf(p.getDiscountValue())).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
      } else if ("FIXED".equalsIgnoreCase(p.getDiscountType())) {
        discount = BigDecimal.valueOf(p.getDiscountValue(), 2).min(subtotal);
      }
      boolean freeShip = "FREE_SHIPPING".equalsIgnoreCase(p.getDiscountType());
      return new CalculatedDiscount(discount, freeShip, p.getCode());
    }

    // Built-in verified promotion codes
    if ("WELCOME10".equals(code)) {
      return new CalculatedDiscount(subtotal.multiply(new BigDecimal("0.10")).setScale(2, java.math.RoundingMode.HALF_UP), false, "WELCOME10");
    } else if ("HEAT20".equals(code)) {
      if (subtotalMinor >= 15000) {
        return new CalculatedDiscount(new BigDecimal("20.00").min(subtotal), false, "HEAT20");
      }
    } else if ("FREESHIP".equals(code)) {
      return new CalculatedDiscount(BigDecimal.ZERO, true, "FREESHIP");
    } else if ("TRADE15".equals(code)) {
      return new CalculatedDiscount(subtotal.multiply(new BigDecimal("0.15")).setScale(2, java.math.RoundingMode.HALF_UP), false, "TRADE15");
    }

    return new CalculatedDiscount(BigDecimal.ZERO, false, null);
  }

  @PostMapping("/promotions/validate")
  public ResponseEntity<Map<String,Object>> validatePromotion(@RequestBody Map<String,Object> body){
    String code = Optional.ofNullable(body.get("code")).map(Object::toString).orElse("").trim().toUpperCase();
    if(code.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Promotion code required");
    BigDecimal subtotal = Optional.ofNullable(body.get("subtotal")).map(s -> new BigDecimal(s.toString())).orElse(BigDecimal.ZERO);
    long subtotalMinor = subtotal.multiply(BigDecimal.valueOf(100)).longValue();

    var found = promotions.findByCodeIgnoreCase(code);
    if (found.isPresent() && found.get().isActive()) {
      var p = found.get();
      if (p.getMinBasketMinor() > 0 && subtotalMinor < p.getMinBasketMinor()) {
        return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Requires minimum basket value of £" + String.format("%.2f", p.getMinBasketMinor() / 100.0)));
      }
      BigDecimal discount = BigDecimal.ZERO;
      if ("PERCENT".equalsIgnoreCase(p.getDiscountType())) {
        discount = subtotal.multiply(BigDecimal.valueOf(p.getDiscountValue())).divide(BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
      } else if ("FIXED".equalsIgnoreCase(p.getDiscountType())) {
        discount = BigDecimal.valueOf(p.getDiscountValue(), 2).min(subtotal);
      }
      boolean freeShip = "FREE_SHIPPING".equalsIgnoreCase(p.getDiscountType());
      return ResponseEntity.ok(Map.of("valid", true, "code", p.getCode(), "label", p.getLabel(), "discount", discount, "freeShipping", freeShip));
    }

    // Built-in verified promotion codes
    if ("WELCOME10".equals(code)) {
      return ResponseEntity.ok(Map.of("valid", true, "code", "WELCOME10", "label", "10% Welcome Discount", "discount", subtotal.multiply(new BigDecimal("0.10")).setScale(2, java.math.RoundingMode.HALF_UP), "freeShipping", false));
    } else if ("HEAT20".equals(code)) {
      if (subtotal.compareTo(new BigDecimal("150")) < 0) return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Requires minimum basket value of £150.00"));
      return ResponseEntity.ok(Map.of("valid", true, "code", "HEAT20", "label", "£20 Heating Season Voucher", "discount", new BigDecimal("20.00").min(subtotal), "freeShipping", false));
    } else if ("FREESHIP".equals(code)) {
      return ResponseEntity.ok(Map.of("valid", true, "code", "FREESHIP", "label", "Free Express UK Delivery", "discount", BigDecimal.ZERO, "freeShipping", true));
    } else if ("TRADE15".equals(code)) {
      return ResponseEntity.ok(Map.of("valid", true, "code", "TRADE15", "label", "15% Trade Discount", "discount", subtotal.multiply(new BigDecimal("0.15")).setScale(2, java.math.RoundingMode.HALF_UP), "freeShipping", false));
    }
    return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "Invalid code. Try WELCOME10, HEAT20, or FREESHIP"));
  }

  @GetMapping("/cms/banners")
  public List<Map<String,Object>> banners(){
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null && !list.isEmpty()){
        var filtered = list.stream()
          .filter(c -> "BANNER".equalsIgnoreCase(String.valueOf(c.get("type"))))
          .sorted(java.util.Comparator.comparingInt(c -> {
            Object s = c.get("sortOrder");
            if (s instanceof Number n) return n.intValue();
            try { return Integer.parseInt(String.valueOf(s)); } catch (Exception ignored) { return 0; }
          }))
          .map(c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", c.get("id"));
            m.put("title", c.get("title") != null ? String.valueOf(c.get("title")) : "");
            m.put("body", c.get("body") != null ? String.valueOf(c.get("body")) : "");
            m.put("tag", c.get("tag") != null ? String.valueOf(c.get("tag")) : "✦ BRITISH HEATING & LUXURY BATHROOMS · 2026");
            m.put("imageUrl", c.get("imageUrl") != null ? String.valueOf(c.get("imageUrl")) : "");
            m.put("buttonText", c.get("buttonText") != null ? String.valueOf(c.get("buttonText")) : "Explore Heating Range →");
            m.put("linkUrl", c.get("linkUrl") != null ? String.valueOf(c.get("linkUrl")) : "#new-arrivals");
            m.put("sortOrder", c.get("sortOrder") != null ? c.get("sortOrder") : 0);
            return m;
          }).toList();
        if (!filtered.isEmpty()) return filtered;
      }
    } catch (Exception ignored) {}
    return List.of(
      Map.of(
        "id", 1,
        "title", "Luxury Heating Built for Considered Homes.",
        "body", "Modern architectural designer radiators, slimline heated towel warmers, and precision UK plumbing components.",
        "tag", "✦ BRITISH HEATING & LUXURY BATHROOMS · 2026",
        "buttonText", "Explore Heating Range →",
        "linkUrl", "#new-arrivals",
        "imageUrl", "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
        "sortOrder", 1
      ),
      Map.of(
        "id", 2,
        "title", "Architectural Designer Radiators.",
        "body", "Anthracite, matte black & polished chrome column radiators engineered for maximum thermal heat output.",
        "tag", "✦ SPECIALIST RADIATOR CURATION",
        "buttonText", "Shop Radiators →",
        "linkUrl", "#new-arrivals",
        "imageUrl", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
        "sortOrder", 2
      ),
      Map.of(
        "id", 3,
        "title", "Precision Water & Electric Underfloor Heating.",
        "body", "Complete room packs with smart digital Wi-Fi thermostats and 25-year pipe warranty.",
        "tag", "✦ COMPLETE ROOM HEATING KITS",
        "buttonText", "Explore Underfloor Range →",
        "linkUrl", "#new-arrivals",
        "imageUrl", "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80",
        "sortOrder", 3
      )
    );
  }

  @GetMapping("/cms/campaigns")
  public List<Map<String,Object>> campaigns(){
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null && !list.isEmpty()){
        var filtered = list.stream()
          .filter(c -> "CAMPAIGN_BANNER".equalsIgnoreCase(String.valueOf(c.get("type"))) || "CAMPAIGN".equalsIgnoreCase(String.valueOf(c.get("type"))))
          .sorted(java.util.Comparator.comparingInt(c -> {
            Object s = c.get("sortOrder");
            if (s instanceof Number n) return n.intValue();
            try { return Integer.parseInt(String.valueOf(s)); } catch (Exception ignored) { return 0; }
          }))
          .map(c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", c.get("id"));
            m.put("title", c.get("title") != null ? String.valueOf(c.get("title")) : "");
            m.put("body", c.get("body") != null ? String.valueOf(c.get("body")) : "");
            m.put("tag", c.get("tag") != null ? String.valueOf(c.get("tag")) : "DESIGN-LED HEATING");
            m.put("imageUrl", c.get("imageUrl") != null ? String.valueOf(c.get("imageUrl")) : "");
            m.put("buttonText", c.get("buttonText") != null ? String.valueOf(c.get("buttonText")) : "Shop Collection →");
            m.put("linkUrl", c.get("linkUrl") != null ? String.valueOf(c.get("linkUrl")) : "/category/Radiators");
            m.put("sortOrder", c.get("sortOrder") != null ? c.get("sortOrder") : 0);
            return m;
          }).toList();
        if (!filtered.isEmpty()) return filtered;
      }
    } catch (Exception ignored) {}
    return List.of(
      Map.of(
        "id", 101,
        "title", "Designer Radiators",
        "body", "Architectural warmth in statement finishes with superior heat outputs.",
        "tag", "DESIGN-LED HEATING",
        "buttonText", "Shop Collection →",
        "linkUrl", "/category/Radiators",
        "imageUrl", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80",
        "sortOrder", 1
      ),
      Map.of(
        "id", 102,
        "title", "Underfloor Heating",
        "body", "Efficient, responsive room climate kits for modern tile and wood floors.",
        "tag", "INVISIBLE COMFORT",
        "buttonText", "Explore Range →",
        "linkUrl", "/category/Underfloor Heating",
        "imageUrl", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80",
        "sortOrder", 2
      )
    );
  }

  @GetMapping("/cms/announcement")
  public Map<String, String> announcement() {
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null && !list.isEmpty()){
        var ann = list.stream().filter(c -> "ANNOUNCEMENT".equalsIgnoreCase(String.valueOf(c.get("type")))).findFirst();
        if (ann.isPresent()) {
          return Map.of("text", String.valueOf(ann.get().get("body")));
        }
      }
    } catch (Exception ignored) {}
    return Map.of("text", "Over 14,000 Verified UK Reviews • Free UK Delivery on orders over £500 • 20-Year Guarantee Protection");
  }

  @GetMapping("/settings/social")
  public Map<String, String> socialSettings() {
    Map<String, String> defaults = new java.util.LinkedHashMap<>();
    defaults.put("facebook", "https://www.facebook.com/share/1CPi7d3YxZ/");
    defaults.put("instagram", "https://www.instagram.com/theheatingandplumbing?srtk=eGt6ZGhmZGcwajU1");
    defaults.put("tiktok", "https://www.tiktok.com/@theheatingandplumbing");
    defaults.put("x", "https://x.com/theheatingandplumbing");
    defaults.put("pinterest", "https://pinterest.com/theheatingandplumbing");
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null) {
        for (var c : list) {
          if ("social-links".equalsIgnoreCase(String.valueOf(c.get("slug")))) {
            String b = String.valueOf(c.get("body"));
            Map<String, String> map = objectMapper.readValue(b, Map.class);
            if (map != null) defaults.putAll(map);
            break;
          }
        }
      }
    } catch (Exception ignored) {}
    return defaults;
  }

  @GetMapping("/cms/pages")
  public List<Map<String,Object>> pages(){
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null) return list;
    } catch (Exception ignored) {}
    return List.of();
  }

  @GetMapping("/cms/navigation")
  public List<Map<String,Object>> navigation(){
    try {
      var list = restClient.get().uri("/api/internal/navigation")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null && !list.isEmpty()){
        List<Map<String,Object>> res = new ArrayList<>();
        for(var m : list){
          Map<String,Object> copy = new LinkedHashMap<>(m);
          if (copy.get("filterOptionsJson") != null) {
            try {
              copy.put("filterOptions", objectMapper.readValue(String.valueOf(copy.get("filterOptionsJson")), Map.class));
            } catch(Exception ignored){}
          }
          if (copy.get("columnsJson") != null) {
            try {
              copy.put("columns", objectMapper.readValue(String.valueOf(copy.get("columnsJson")), List.class));
            } catch(Exception ignored){}
          }
          if (copy.get("featuredPromoJson") != null) {
            try {
              copy.put("featuredPromo", objectMapper.readValue(String.valueOf(copy.get("featuredPromoJson")), Map.class));
            } catch(Exception ignored){}
          }
          res.add(copy);
        }
        return res;
      }
    } catch (Exception e) {
      System.err.println("StoreController navigation fetch notice: " + e.getMessage());
    }
    return List.of();
  }

  private Map<String, String> buildCmsResponse(Map<String, Object> c) {
    Map<String, String> res = new LinkedHashMap<>();
    res.put("title", String.valueOf(c.get("title")));
    res.put("body", String.valueOf(c.get("body")));
    res.put("seoTitle", Optional.ofNullable(c.get("seoTitle")).map(Object::toString).orElse(""));
    res.put("pdfUrl", Optional.ofNullable(c.get("pdfUrl")).map(Object::toString).orElse(""));
    res.put("pdfFilename", Optional.ofNullable(c.get("pdfFilename")).map(Object::toString).orElse(""));
    return res;
  }

  @GetMapping("/cms/pages/{slug}")
  public Map<String,String> page(@PathVariable("slug") String slug){
    try {
      var list = restClient.get().uri("/api/internal/content/published")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .retrieve()
        .body(new ParameterizedTypeReference<List<Map<String,Object>>>(){});
      if(list != null){
        String cleanSlug = slug != null ? slug.trim().toLowerCase() : "";
        // First try exact match
        for(var c : list){
          String s = String.valueOf(c.get("slug")).toLowerCase();
          if(cleanSlug.equals(s)){
            return buildCmsResponse(c);
          }
        }
        // Then try alias matches (terms <-> terms-and-conditions, privacy <-> privacy-policy, faq <-> faqs)
        for(var c : list){
          String s = String.valueOf(c.get("slug")).toLowerCase();
          boolean match = false;
          if ((cleanSlug.equals("terms") || cleanSlug.equals("terms-and-conditions") || cleanSlug.equals("terms-of-sale") || cleanSlug.equals("terms-conditions")) &&
              (s.equals("terms-and-conditions") || s.equals("terms-of-sale") || s.equals("terms"))) {
            match = true;
          } else if ((cleanSlug.equals("privacy") || cleanSlug.equals("privacy-policy")) &&
                     (s.equals("privacy-policy") || s.equals("privacy"))) {
            match = true;
          } else if ((cleanSlug.equals("faq") || cleanSlug.equals("faqs") || cleanSlug.equals("help")) &&
                     (s.equals("faq") || s.equals("faqs"))) {
            match = true;
          }
          if(match){
            return buildCmsResponse(c);
          }
        }
      }
    } catch (Exception e) { e.printStackTrace(); }
    return Map.of("title", slug.replace("-", " ").toUpperCase(), "body", "Official customer support and documentation for THP Heating & Plumbing operated by DIGNITREE LTD (Company number: 16079437, VAT: GB 480 9842 55, Registered Office: First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU, Email: sales@theheatingandplumbing.com).", "pdfUrl", "", "pdfFilename", "");
  }

  @GetMapping("/inquiries/my")
  public List<CustomerInquiry> myInquiries(Authentication auth) {
    if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required to access support inquiries");
    }
    String custEmail = auth.getName().trim().toLowerCase();
    return inquiries.findByEmailIgnoreCaseOrderByCreatedAtDesc(custEmail);
  }

  @GetMapping("/inquiries/track/{ticketNumber}")
  public ResponseEntity<Map<String, Object>> trackInquiry(@PathVariable("ticketNumber") String ticketNumber) {
    String q = ticketNumber != null ? ticketNumber.trim() : "";
    if (q.startsWith("#")) q = q.substring(1).trim();
    var found = inquiries.findByTicketNumber(q);
    if (found.isEmpty() && q.matches("\\d+")) {
      found = inquiries.findById(Long.parseLong(q));
    }
    if (found.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    var inq = found.get();
    Map<String, Object> resp = new HashMap<>();
    resp.put("id", inq.getId());
    resp.put("ticketNumber", inq.getTicketNumber());
    resp.put("status", inq.getStatus());
    resp.put("category", inq.getCategory());
    resp.put("name", inq.getName());
    String email = inq.getEmail();
    if (email != null && email.contains("@")) {
      String[] parts = email.split("@", 2);
      String userPart = parts[0].length() > 2 ? parts[0].substring(0, 2) + "***" : parts[0] + "***";
      resp.put("maskedEmail", userPart + "@" + parts[1]);
    } else {
      resp.put("maskedEmail", "");
    }
    resp.put("orderNumber", inq.getOrderNumber());
    resp.put("productName", inq.getProductName());
    resp.put("productSku", inq.getProductSku());
    resp.put("message", inq.getMessage());
    resp.put("attachmentUrl", inq.getAttachmentUrl());
    resp.put("attachmentFilename", inq.getAttachmentFilename());
    resp.put("resolutionNotes", inq.getResolutionNotes());
    resp.put("createdAt", inq.getCreatedAt());

    boolean orderVerified = false;
    if (inq.getOrderNumber() != null && !inq.getOrderNumber().isBlank()) {
      String cleanOrder = inq.getOrderNumber().trim();
      if (cleanOrder.startsWith("#")) cleanOrder = cleanOrder.substring(1).trim();
      var opt = orders.findByOrderNumber(cleanOrder);
      if (opt.isEmpty()) opt = orders.findById(cleanOrder);
      if (opt.isPresent()) orderVerified = true;
    }
    resp.put("orderVerified", orderVerified);

    return ResponseEntity.ok(resp);
  }

  @PostMapping(value={"/inquiries/upload", "/inquiries/upload-attachment"}, consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String,String> uploadInquiryAttachment(@RequestPart("file") MultipartFile file) throws IOException {
    if(file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a file to upload");
    if(file.getSize() > 15 * 1024 * 1024) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds maximum size limit of 15MB");

    byte[] header = file.getInputStream().readNBytes(12);
    if (!isValidMediaSignature(header)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file format. Please upload a valid JPG, PNG, WebP, GIF, or PDF document.");
    }

    String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "attachment.jpg";
    String ext = ".jpg";
    int dot = original.lastIndexOf('.');
    if (dot > 0) {
      String foundExt = original.substring(dot).toLowerCase();
      if (List.of(".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf").contains(foundExt)) {
        ext = foundExt;
      }
    }
    String filename = "claim-" + UUID.randomUUID().toString().substring(0, 12) + ext;
    Path primaryTarget = Path.of(uploadDir).resolve(filename).normalize();
    Files.createDirectories(primaryTarget.getParent());
    file.transferTo(primaryTarget);

    // Replicate to Admin and Frontend public directories so it displays everywhere
    for (String destPath : List.of(
        "../admin/backend/data/product-images/" + filename,
        "../../admin/backend/data/product-images/" + filename,
        "../shopify/frontend/public/api/product-images/" + filename,
        "../../shopify/frontend/public/api/product-images/" + filename,
        "./data/product-images/" + filename
    )) {
      try {
        Path p = Path.of(destPath).toAbsolutePath().normalize();
        Files.createDirectories(p.getParent());
        Files.copy(primaryTarget, p, StandardCopyOption.REPLACE_EXISTING);
      } catch (Exception ignored) {}
    }

    String fileUrl = "/api/product-images/" + filename;
    return Map.of("url", fileUrl, "attachmentUrl", fileUrl, "filename", original);
  }

  private boolean isValidMediaSignature(byte[] b) {
    if (b == null || b.length < 4) return false;
    // PDF: %PDF
    if (b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F') return true;
    // JPEG: 0xFF, 0xD8, 0xFF
    if ((b[0] & 255) == 255 && (b[1] & 255) == 216 && (b[2] & 255) == 255) return true;
    // PNG: 0x89, 'P', 'N', 'G'
    if ((b[0] & 255) == 137 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return true;
    // GIF: GIF87a or GIF89a
    if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F') return true;
    // WebP: RIFF....WEBP
    if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return true;
    return false;
  }

  @PostMapping("/inquiries")
  public ResponseEntity<Map<String,Object>> submitInquiry(@RequestBody Map<String,String> body, Authentication auth){
    String name = Optional.ofNullable(body.get("name")).filter(s->!s.isBlank()).orElse("Storefront Customer");
    String email = Optional.ofNullable(body.get("email")).filter(s->!s.isBlank()).orElse(auth != null ? auth.getName() : "");
    String phone = Optional.ofNullable(body.get("phone")).orElse("");
    String category = Optional.ofNullable(body.get("category")).orElse("General Inquiry");
    String orderNumber = Optional.ofNullable(body.get("orderNumber")).orElse("");
    String productSku = Optional.ofNullable(body.get("productSku")).orElse("");
    String productName = Optional.ofNullable(body.get("productName")).orElse("");
    String attachmentUrl = Optional.ofNullable(body.get("attachmentUrl")).orElse("");
    String attachmentFilename = Optional.ofNullable(body.get("attachmentFilename")).orElse("");
    String message = Optional.ofNullable(body.get("message")).orElse("");
    if(message.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Message is required");

    String ticketNumber = "TKT-2026-" + String.format("%05d", (int)(Math.random() * 90000) + 10000);
    var saved = inquiries.save(new CustomerInquiry(
      ticketNumber, name, email, phone, category,
      orderNumber, productSku, productName,
      attachmentUrl, attachmentFilename, message
    ));

    Map<String, Object> adminPayload = new HashMap<>();
    adminPayload.put("ticketNumber", ticketNumber);
    adminPayload.put("name", name);
    adminPayload.put("email", email);
    adminPayload.put("phone", phone);
    adminPayload.put("category", category);
    adminPayload.put("orderNumber", orderNumber);
    adminPayload.put("productSku", productSku);
    adminPayload.put("productName", productName);
    adminPayload.put("attachmentUrl", attachmentUrl);
    adminPayload.put("attachmentFilename", attachmentFilename);
    adminPayload.put("message", message);
    adminPayload.put("status", "NEW");
    syncRetryService.executeOrQueue("/api/internal/inquiries/sync", adminPayload);
    return ResponseEntity.ok(Map.of(
      "success", true,
      "id", saved.getId(),
      "ticketNumber", ticketNumber,
      "message", "Inquiry received. A technical advisor will contact you.",
      "inquiry", saved
    ));
  }

  @GetMapping("/admin/summary")
  public Map<String,Object> summary(){
    return Map.of("products",products.count(),"orders",orders.count(),"lowStock",products.findAll().stream().filter(p->p.getStock()<10).count(),"revenue",orders.findAll().stream().map(CustomerOrder::getTotal).reduce(BigDecimal.ZERO,BigDecimal::add));
  }

  @GetMapping("/reviews")
  public List<ProductReview> getReviews(
      @RequestParam(name = "productId", required = false) Long productId,
      @RequestParam(name = "category", required = false) String category,
      @RequestParam(name = "customerKey", required = false) String customerKey,
      @RequestParam(name = "status", required = false) String status) {
    var all = reviews.findAllByOrderByCreatedAtDesc();

    if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())) {
      String filterStatus = status.trim().toUpperCase();
      all = all.stream().filter(r -> filterStatus.equalsIgnoreCase(r.getStatus())).toList();
    } else if (status == null || !"ALL".equalsIgnoreCase(status.trim())) {
      all = all.stream().filter(r -> {
        boolean isApproved = "APPROVED".equalsIgnoreCase(r.getStatus()) || r.getStatus() == null;
        boolean isCustomerPending = customerKey != null && !customerKey.isBlank() &&
            customerKey.equals(r.getCustomerKey()) && "PENDING_APPROVAL".equalsIgnoreCase(r.getStatus());
        return isApproved || isCustomerPending;
      }).toList();
    }

    if (productId != null) {
      all = all.stream().filter(r -> r.getProductId() != null && r.getProductId().equals(productId)).toList();
    } else if (category != null && !category.isBlank()) {
      all = all.stream().filter(r -> r.getCategory() != null && r.getCategory().equalsIgnoreCase(category.trim())).toList();
    }
    return all;
  }

  @PostMapping("/reviews")
  public ResponseEntity<ProductReview> submitReview(@Valid @RequestBody CreateReviewRequest req) {
    String author = (req.author() == null || req.author().isBlank()) ? "Verified Customer" : req.author().trim();
    String location = (req.location() == null || req.location().isBlank()) ? "United Kingdom" : req.location().trim();
    String role = (req.role() == null || req.role().isBlank()) ? "Verified Homeowner" : req.role().trim();
    String title = (req.title() == null || req.title().isBlank()) ? "Great product!" : req.title().trim();
    String comment = (req.comment() == null) ? "" : req.comment().trim();
    if (comment.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Review comment cannot be empty");
    }

    int rating = req.rating() == null ? 5 : Math.max(1, Math.min(5, req.rating()));
    String category = req.category();
    String sku = null;

    if (req.productId() != null) {
      var prod = products.findById(req.productId());
      if (prod.isPresent()) {
        sku = prod.get().getSku();
        if (category == null || category.isBlank()) {
          category = prod.get().getCategory();
        }
      }
    }

    String customerKey = (req.customerKey() != null && !req.customerKey().isBlank()) ? req.customerKey().trim() : UUID.randomUUID().toString();

    ProductReview newReview = new ProductReview(
      req.productId(),
      sku,
      category,
      author,
      req.authorEmail(),
      customerKey,
      location,
      role,
      rating,
      title,
      comment,
      "PENDING_APPROVAL",
      true
    );

    ProductReview saved = reviews.save(newReview);

    // Sync to Admin backend for approval
    try {
      Map<String, Object> adminPayload = new HashMap<>();
      adminPayload.put("storeReviewId", saved.getId());
      adminPayload.put("productId", saved.getProductId() != null ? saved.getProductId() : 0L);
      adminPayload.put("productSku", saved.getProductSku() != null ? saved.getProductSku() : "");
      adminPayload.put("category", saved.getCategory() != null ? saved.getCategory() : "");
      adminPayload.put("author", saved.getAuthor());
      adminPayload.put("authorEmail", saved.getAuthorEmail() != null ? saved.getAuthorEmail() : "");
      adminPayload.put("customerKey", saved.getCustomerKey());
      adminPayload.put("location", saved.getLocation());
      adminPayload.put("role", saved.getRole());
      adminPayload.put("rating", saved.getRating());
      adminPayload.put("title", saved.getTitle());
      adminPayload.put("comment", saved.getComment());
      adminPayload.put("status", saved.getStatus());

      restClient.post().uri("/api/internal/reviews/sync")
        .header("X-Catalogue-Sync-Secret", syncSecret)
        .contentType(MediaType.APPLICATION_JSON)
        .body(adminPayload)
        .retrieve().toBodilessEntity();
    } catch (Exception ignored) {}

    return ResponseEntity.status(HttpStatus.CREATED).body(saved);
  }

  @PostMapping("/reviews/{id}/approve")
  public ResponseEntity<ProductReview> approveReview(@PathVariable("id") Long id) {
    var opt = reviews.findById(id);
    if (opt.isEmpty()) return ResponseEntity.notFound().build();
    ProductReview r = opt.get();
    r.setStatus("APPROVED");
    ProductReview saved = reviews.save(r);
    return ResponseEntity.ok(saved);
  }

  @PostMapping("/reviews/{id}/reject")
  public ResponseEntity<ProductReview> rejectReview(@PathVariable("id") Long id) {
    var opt = reviews.findById(id);
    if (opt.isEmpty()) return ResponseEntity.notFound().build();
    ProductReview r = opt.get();
    r.setStatus("REJECTED");
    ProductReview saved = reviews.save(r);
    return ResponseEntity.ok(saved);
  }

  @PostMapping("/internal/reviews/{id}/status")
  public ResponseEntity<Map<String, Object>> updateReviewStatusInternal(
      @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String supplied,
      @PathVariable("id") Long id,
      @RequestBody Map<String, String> body) {
    if (supplied == null || syncSecret == null ||
        !java.security.MessageDigest.isEqual(
            syncSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            supplied.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid catalogue sync secret");
    }
    var opt = reviews.findById(id);
    if (opt.isEmpty()) return ResponseEntity.notFound().build();
    ProductReview r = opt.get();
    String newStatus = body.getOrDefault("status", "APPROVED");
    r.setStatus(newStatus);
    reviews.save(r);
    return ResponseEntity.ok(Map.of("success", true, "id", r.getId(), "status", r.getStatus()));
  }

  @PostMapping("/internal/customers/status-update")
  public ResponseEntity<Map<String, Object>> updateCustomerStatusInternal(
      @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String supplied,
      @RequestBody Map<String, Object> body) {
    if (supplied == null || syncSecret == null ||
        !java.security.MessageDigest.isEqual(
            syncSecret.getBytes(java.nio.charset.StandardCharsets.UTF_8),
            supplied.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid catalogue sync secret");
    }
    String email = String.valueOf(body.getOrDefault("email", "")).trim().toLowerCase();
    String status = String.valueOf(body.getOrDefault("status", "ACTIVE")).trim().toUpperCase();
    boolean active = "ACTIVE".equalsIgnoreCase(status);
    var opt = users.findByEmailIgnoreCase(email);
    if (opt.isPresent()) {
      var u = opt.get();
      u.setEnabled(active);
      users.save(u);
      return ResponseEntity.ok(Map.of("success", true, "email", email, "enabled", active));
    }
    return ResponseEntity.ok(Map.of("success", false, "message", "User not found in store database"));
  }

  @PostMapping("/reviews/{id}/helpful")
  public ResponseEntity<Map<String, Object>> markReviewHelpful(@PathVariable("id") Long id) {
    var opt = reviews.findById(id);
    if (opt.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    ProductReview r = opt.get();
    int updatedCount = (r.getHelpfulCount() != null ? r.getHelpfulCount() : 0) + 1;
    r.setHelpfulCount(updatedCount);
    reviews.save(r);
    return ResponseEntity.ok(Map.of("id", r.getId(), "helpfulCount", updatedCount));
  }

  @DeleteMapping("/reviews/{id}")
  public ResponseEntity<Void> deleteReview(@PathVariable("id") Long id) {
    if (reviews.existsById(id)) {
      reviews.deleteById(id);
      return ResponseEntity.noContent().build();
    }
    return ResponseEntity.notFound().build();
  }

  @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> handleValidationException(org.springframework.web.bind.MethodArgumentNotValidException ex) {
    String detail = ex.getBindingResult().getFieldErrors().stream()
      .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
      .findFirst().orElse("Invalid request payload");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
      "status", 400,
      "message", "Validation error: " + detail,
      "error", "Bad Request"
    ));
  }

  public record CartLine(@NotNull Long productId, Long variantId, @Min(1) @Max(99) int quantity){}
  public record CheckoutRequest(
    @NotEmpty List<@Valid CartLine> items,
    @NotBlank @Size(max=1000) String shippingAddress,
    String customerName,
    String customerEmail,
    String customerPhone,
    String discountCode,
    BigDecimal discountAmount,
    String paymentMethod,
    String paymentStatus,
    String stripePaymentIntentId
  ){}
  public record CreateReviewRequest(
    Long productId,
    String category,
    String author,
    String authorEmail,
    String customerKey,
    String location,
    String role,
    Integer rating,
    String title,
    @NotBlank String comment
  ){}

  public static boolean isRestrictedUkPostcode(String address) {
    if (address == null || address.isBlank()) return false;
    String upper = address.toUpperCase().replaceAll("[^A-Z0-9]", " ");
    String[] tokens = upper.split("\\s+");
    for (String token : tokens) {
      if (token.startsWith("BT") && token.length() >= 3) return true;
      if (token.startsWith("ZE") && token.length() >= 3) return true;
      if (token.startsWith("IV") && token.length() >= 3) return true;
      if (token.startsWith("KW") && token.length() >= 3) return true;
      if (token.startsWith("JE") && token.length() >= 3) return true;
      if (token.startsWith("GY") && token.length() >= 3) return true;
      if (token.startsWith("IM") && token.length() >= 3) return true;
      java.util.regex.Matcher m = java.util.regex.Pattern.compile("^([A-Z]{1,2})(\\d{1,2})").matcher(token);
      if (m.find()) {
        String prefix = m.group(1);
        int num = Integer.parseInt(m.group(2));
        if (prefix.equals("PA") && num >= 20 && num <= 80) return true;
        if (prefix.equals("PH") && num >= 6 && num <= 50) return true;
        if (prefix.equals("PO") && num >= 30 && num <= 41) return true;
        if (prefix.equals("KA") && (num == 27 || num == 28)) return true;
        if (prefix.equals("KY") && ((num >= 9 && num <= 10) || (num >= 14 && num <= 16))) return true;
        if (prefix.equals("TD") && ((num >= 1 && num <= 8) || (num >= 10 && num <= 14))) return true;
        if (prefix.equals("TR") && num >= 21 && num <= 25) return true;
      }
    }
    return false;
  }
}

