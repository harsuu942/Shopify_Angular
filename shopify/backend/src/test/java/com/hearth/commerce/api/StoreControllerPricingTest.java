package com.hearth.commerce.api;

import com.hearth.commerce.domain.Product;
import com.hearth.commerce.repo.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class StoreControllerPricingTest {
  @Test
  void appliesWeightBoundariesAndHighestSupplierCharge() {
    var policy = new StoreController.WeightPolicy(List.of(
        new StoreController.WeightBracket(BigDecimal.TEN, 1500),
        new StoreController.WeightBracket(new BigDecimal("20"), 2000),
        new StoreController.WeightBracket(new BigDecimal("50"), 3000)),
        5000, 5000, 5000, List.of(
        new StoreController.SupplierRule("Kartel", "FIXED", 5000, true, false),
        new StoreController.SupplierRule("Ultraheat", "MINIMUM", 5000, true, false),
        new StoreController.SupplierRule("A", "FIXED", 2500, true, false),
        new StoreController.SupplierRule("B", "FIXED", 3500, true, false),
        new StoreController.SupplierRule("C", "FIXED", 7000, true, false)));

    assertEquals(1500, StoreController.weightPolicyCharge(policy, List.of(item("", "10"))));
    assertEquals(2000, StoreController.weightPolicyCharge(policy, List.of(item("", "15"))));
    assertEquals(3000, StoreController.weightPolicyCharge(policy, List.of(item("", "50"))));
    assertEquals(5000, StoreController.weightPolicyCharge(policy, List.of(item("", "50.001"))));
    assertEquals(5000, StoreController.weightPolicyCharge(policy, List.of(item("", null))));
    assertEquals(3500, StoreController.weightPolicyCharge(policy, List.of(item("A", "5"), item("B", "5"))));
    assertEquals(5000, StoreController.weightPolicyCharge(policy, List.of(item("Kartel", "5"), item("Ultraheat", "5"), item("", "5"))));
    assertEquals(5000, StoreController.weightPolicyCharge(policy, List.of(item("C", "1"))));
  }

  private StoreController.ShippingItem item(String supplier, String kg) {
    return new StoreController.ShippingItem(supplier, kg == null ? null : new BigDecimal(kg), 1);
  }
  @SuppressWarnings("unchecked")
  private <T> T repository(Class<T> type, java.lang.reflect.InvocationHandler handler) {
    return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
  }

  private StoreController controller(Product product) {
    ProductRepository products = repository(ProductRepository.class, (proxy, method, args) ->
        method.getName().equals("findById") ? Optional.of(product) : defaultValue(method.getReturnType()));
    PromotionRepository promotions = repository(PromotionRepository.class, (proxy, method, args) ->
        method.getName().equals("findByCodeIgnoreCase") ? Optional.empty() : defaultValue(method.getReturnType()));
    return new StoreController(products, null, null, promotions, null, null, null,
        "http://127.0.0.1:9", "test-sync-secret", "/tmp/thp-test-images", "pk_test_example", "sk_test_example", "whsec_example") {
      @Override
      public ShippingRates shippingRates() {
        return new ShippingRates(2499, 50000, 0, List.of());
      }
    };
  }

  private Object defaultValue(Class<?> type) {
    if (!type.isPrimitive()) return null;
    if (type == boolean.class) return false;
    if (type == long.class) return 0L;
    if (type == int.class) return 0;
    return null;
  }

  @Test
  void calculatesPaymentAmountOnlyFromServerProductPrice() throws Exception {
    Product product = new Product("SKU-1", "Radiator", "THP", "Radiators", "", new BigDecimal("100.00"), 5, "", "", 10, 0, 0, "");
    var method = StoreController.class.getDeclaredMethod("calculateBasket", List.class, String.class);
    method.setAccessible(true);
    Object result = method.invoke(controller(product), List.of(new StoreController.CartLine(1L, null, 2)), null);
    var total = result.getClass().getDeclaredMethod("total");
    total.setAccessible(true);

    assertEquals(new BigDecimal("224.99"), total.invoke(result));
  }

  @Test
  void rejectsExcludedPostcodesBeforeCreatingPaymentIntent() {
    var controller = controller(null);
    for (String postcode : List.of("BT1 5GS", "JE2 3QA", "GY1 1AA", "IM1 1AA")) {
      var request = new StoreController.PaymentIntentRequest(List.of(), postcode, null, null, null);
      var exception = assertThrows(ResponseStatusException.class,
          () -> controller.createPaymentIntent(request, "test-idempotency-key"));
      assertEquals(400, exception.getStatusCode().value());
      assertEquals("Delivery is available only in England and Wales.", exception.getReason());
    }
  }

  @Test
  void rejectsQuantityAboveCurrentServerStock() throws Exception {
    Product product = new Product("SKU-1", "Radiator", "THP", "Radiators", "", new BigDecimal("100.00"), 1, "", "", 10, 0, 0, "");
    var method = StoreController.class.getDeclaredMethod("calculateBasket", List.class, String.class);
    method.setAccessible(true);

    InvocationTargetException thrown = assertThrows(InvocationTargetException.class,
        () -> method.invoke(controller(product), List.of(new StoreController.CartLine(1L, null, 2)), null));
    assertInstanceOf(ResponseStatusException.class, thrown.getCause());
    assertEquals(409, ((ResponseStatusException) thrown.getCause()).getStatusCode().value());
  }
}
