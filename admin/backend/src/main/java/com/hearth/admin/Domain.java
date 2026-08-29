package com.hearth.admin;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;

@MappedSuperclass
abstract class BaseEntity {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
  public Instant createdAt = Instant.now();
  public Instant updatedAt = Instant.now();
  @PreUpdate void touch() { updatedAt = Instant.now(); }
}

@Entity @Table(name="admin_users")
class AdminUser extends BaseEntity {
  @Column(unique=true, nullable=false) public String email;
  @Column(nullable=false) public String passwordHash;
  public String name;
  public String role = "ADMIN";
  public boolean active = true;
}

@Entity @Table(name="products", indexes={@Index(name="idx_product_status", columnList="status"), @Index(name="idx_product_name", columnList="name")})
class Product extends BaseEntity {
  @Column(unique=true, nullable=false) public String sku;
  @Column(nullable=false) public String name;
  public String brand;
  public String category;
  @Column(length=2000) public String description;
  public long priceMinor;
  public long costMinor;
  public int stock;
  public int lowStockThreshold = 10;
  public String status = "DRAFT";
  public String taxClass = "STANDARD";
  public String shippingClass = "STANDARD";
  public String imageUrl;
  public String sourceUrl;
  public boolean archived;
}

@Entity @Table(name="customers")
class Customer extends BaseEntity {
  @Column(nullable=false) public String name;
  @Column(unique=true, nullable=false) public String email;
  public String phone;
  public String status = "ACTIVE";
  public boolean marketingConsent;
  public long lifetimeValueMinor;
  public String city;
  @Column(length=1000) public String adminNotes;
}

@Entity @Table(name="quotations")
class Quotation extends BaseEntity {
  @Column(unique=true) public String quoteNumber;
  public String customerName;
  public String customerEmail;
  public long subtotalMinor;
  public long taxMinor;
  public long totalMinor;
  public String status = "DRAFT";
  public LocalDate expiresOn;
  public int revision = 1;
  @Column(length=1200) public String notes;
}

@Entity @Table(name="commerce_orders")
class CommerceOrder extends BaseEntity {
  @Column(unique=true) public String orderNumber;
  public String customerName;
  public String customerEmail;
  public long totalMinor;
  public String orderStatus = "PROCESSING";
  public String paymentStatus = "PENDING";
  public String fulfilmentStatus = "UNFULFILLED";
  public String channel = "ADMIN";
  public String warehouse = "Main Warehouse";
  public String trackingNumber;
}

@Entity @Table(name="inventory_transactions")
class InventoryTransaction extends BaseEntity {
  public Long productId;
  public String sku;
  public String productName;
  public String warehouse;
  public String type;
  public int quantityChange;
  public int beforeQuantity;
  public int afterQuantity;
  public String reason;
  public String reference;
  public String performedBy;
}

@Entity @Table(name="cms_content")
class CmsContent extends BaseEntity {
  public String title;
  @Column(unique=true) public String slug;
  public String type = "PAGE";
  public String status = "DRAFT";
  @Column(length=8000) public String body;
  public String seoTitle;
  public String metaDescription;
  public Instant publishedAt;
}

@Entity @Table(name="audit_logs", indexes=@Index(name="idx_audit_created", columnList="createdAt"))
class AuditLog extends BaseEntity {
  public String actor;
  public String action;
  public String entityType;
  public String entityId;
  @Column(length=1500) public String detail;
  public String ipAddress;
}
