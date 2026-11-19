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
        "http://127.0.0.1:9", "test-sync-secret", "/tmp/thp-test-images", "pk_test_example", "sk_test_example", "whsec_example");
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
