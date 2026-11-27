package com.hearth.admin;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class InternalSyncControllerTest {
  @Test
  void inventoryAdjustmentChangesSelectedVariantAndRecalculatesParentTotal() {
    var products = mock(ProductRepository.class);
    var inventory = mock(InventoryTransactionRepository.class);
    var sync = mock(CatalogueSyncService.class);
    var product = new Product();
    product.id = 91L;
    product.sku = "PARENT-1";
    product.name = "Radiator";
    var white = variant(101L, "VAR-WHITE", "5000000000001", 7);
    var black = variant(102L, "VAR-BLACK", "5000000000002", 5);
    white.product = product;
    black.product = product;
    product.variants.addAll(List.of(white, black));
    product.stock = 12;
    when(products.findById(91L)).thenReturn(Optional.of(product));
    when(products.save(any())).thenAnswer(i -> i.getArgument(0));
    when(inventory.save(any())).thenAnswer(i -> i.getArgument(0));
    var auth = mock(Authentication.class);
    when(auth.getName()).thenReturn("admin@example.com");

    var controller = new InventoryController(products, inventory, mock(AuditService.class), sync);
    var result = controller.adjust(91L,
        new StockRequest(3, "ADD", "Main Warehouse", "Supplier delivery", "PO-1", 102L, "VAR-BLACK"),
        auth, mock(jakarta.servlet.http.HttpServletRequest.class));

    assertEquals(7, white.stock);
    assertEquals(8, black.stock);
    assertEquals(15, product.stock);
    assertEquals(5, result.beforeQuantity);
    assertEquals(8, result.afterQuantity);
    verify(sync).sync(product);
  }

  @Test
  void orderRetryDoesNotDoubleDeductAndStableSkuUpdatesExactVariant() {
    var orders = mock(CommerceOrderRepository.class);
    var customers = mock(CustomerRepository.class);
    var products = mock(ProductRepository.class);
    var inventory = mock(InventoryTransactionRepository.class);
    var orderRef = new AtomicReference<CommerceOrder>();

    when(orders.findByOrderNumber("ORD-1")).thenAnswer(i -> Optional.ofNullable(orderRef.get()));
    when(orders.save(any())).thenAnswer(i -> {
      CommerceOrder value = i.getArgument(0);
      orderRef.set(value);
      return value;
    });
    when(customers.findByEmailIgnoreCase(any())).thenReturn(Optional.empty());
    when(customers.save(any())).thenAnswer(i -> i.getArgument(0));
    when(inventory.save(any())).thenAnswer(i -> i.getArgument(0));

    var product = new Product();
    product.id = 91L;
    product.sku = "PARENT-1";
    product.name = "Radiator";
    product.stock = 12;
    var white = variant(101L, "VAR-WHITE", "5000000000001", 7);
    var black = variant(102L, "VAR-BLACK", "5000000000002", 5);
    white.product = product;
    black.product = product;
    product.variants.addAll(List.of(white, black));
    when(products.findBySku("PARENT-1")).thenReturn(Optional.of(product));
    when(products.save(any())).thenAnswer(i -> i.getArgument(0));

    var controller = new InternalSyncController("secret", orders, customers, products, inventory,
        mock(CustomerInquiryRepository.class), mock(ProductReviewRepository.class),
        mock(CmsContentRepository.class), mock(CatalogueSyncService.class), mock(AdminDocumentMailService.class));
    var item = new StorefrontOrderItem(500L, 999L, "PARENT-1", "PARENT-1",
        "VAR-BLACK", "5000000000002", 2, 1000);
    var payload = new StorefrontOrderPayload("ORD-1", "Buyer", "buyer@example.com", "07123456789",
        2000, "London", null, 0L, "[]", List.of(item));

    controller.syncOrder("secret", payload);
    controller.syncOrder("secret", payload); // queue retries are expected and must be idempotent

    assertEquals(10, product.stock);
    assertEquals(7, white.stock);
    assertEquals(3, black.stock);
    verify(inventory, times(1)).save(any(InventoryTransaction.class));
    verify(products, times(1)).save(product);
  }

  private ProductVariant variant(long id, String sku, String ean, int stock) {
    var variant = new ProductVariant();
    variant.id = id;
    variant.variantSku = sku;
    variant.ean = ean;
    variant.stock = stock;
    return variant;
  }
}
