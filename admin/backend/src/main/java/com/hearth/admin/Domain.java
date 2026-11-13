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
  @Column(nullable=false,length=500) public String name;
  public String brand;
  public String category;
  @Column(length=4000) public String description;
  public long priceMinor;
  public long costMinor;
  public int stock;
  public int lowStockThreshold = 10;
  public Integer discountPercent = 0;
  public String status = "DRAFT";
  public String taxClass = "STANDARD";
  public String shippingClass = "STANDARD";
  public String imageUrl;
  public String sourceUrl;
  public boolean archived;
  public String availability;
  public String leadTime;
  public boolean unlimitedStock;
  public Long staticContentId;
  public String staticContentSlug;
  @Column(length=4000) public String documentsJson;
  public String syncStatus = "PENDING";
  @Column(length=1000) public String syncError;
  public Instant lastSyncedAt;
  @OneToMany(mappedBy="product", cascade=CascadeType.ALL, orphanRemoval=true, fetch=FetchType.EAGER)
  @OrderBy("id asc") public java.util.List<ProductVariant> variants = new java.util.ArrayList<>();

  void replaceVariants(java.util.Collection<ProductVariant> incoming) {
    var copy=incoming==null?java.util.List.<ProductVariant>of():new java.util.ArrayList<>(incoming);
    var byEan=new java.util.HashMap<String,ProductVariant>();
    var bySku=new java.util.HashMap<String,ProductVariant>();
    for(var existing:variants){if(existing.ean!=null)byEan.put(existing.ean,existing);if(existing.variantSku!=null)bySku.put(existing.variantSku,existing);}
    var reconciled=new java.util.ArrayList<ProductVariant>();
    for(var submitted:copy){
      var target=submitted.ean==null?null:byEan.get(submitted.ean);
      if(target==null&&submitted.variantSku!=null)target=bySku.get(submitted.variantSku);
      if(target==null)target=new ProductVariant();
      target.copyFrom(submitted);target.product=this;reconciled.add(target);
    }
    variants.clear();variants.addAll(reconciled);
    if(!variants.isEmpty() && !unlimitedStock){
      stock = variants.stream().mapToInt(v -> v.stock != null ? v.stock : 0).sum();
    }
  }
}

@Entity @Table(name="product_variants", indexes={@Index(name="idx_variant_ean",columnList="ean"),@Index(name="idx_variant_sku",columnList="variantSku")})
class ProductVariant extends BaseEntity {
  @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="product_id") @com.fasterxml.jackson.annotation.JsonIgnore public Product product;
  @Column(unique=true,nullable=false) public String ean;
  @Column(unique=true,nullable=false) public String variantSku;
  public String configCode;
  public String colour;
  public String baseColour;
  public String colourCode;
  public String paintType;
  public Integer heightMm;
  public Integer widthMm;
  public Integer depthMm;
  public String panel;
  public Long priceMinor;
  public Long costMinor;
  public Integer discountPercent = 0;
  public Integer stock;
  public boolean unlimitedStock;
  public String availability;
  public String productionTime;
  public String leadTime;
  public Integer watts;
  public Integer btu;
  public Integer warrantyYears;
  public String imageUrl;
  @Column(length=4000) public String imageUrlsJson;

  void copyFrom(ProductVariant v){
    ean=v.ean;variantSku=v.variantSku;configCode=v.configCode;colour=v.colour;baseColour=v.baseColour;colourCode=v.colourCode;paintType=v.paintType;
    heightMm=v.heightMm;widthMm=v.widthMm;depthMm=v.depthMm;panel=v.panel;priceMinor=v.priceMinor;costMinor=v.costMinor;discountPercent=v.discountPercent!=null?v.discountPercent:0;stock=v.stock;
    unlimitedStock=v.unlimitedStock;availability=v.availability;productionTime=v.productionTime;leadTime=v.leadTime;watts=v.watts;btu=v.btu;warrantyYears=v.warrantyYears;imageUrl=v.imageUrl;imageUrlsJson=v.imageUrlsJson;
  }
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
  @Column(length=1000) public String customerAddress;
  public String companyEmail = "sales@theheatingandplumbing.com";
  public String companyPhone = "+44 7404 095699";
  public String companyAddress = "First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU";
  @Column(columnDefinition="LONGTEXT") public String lineItemsJson;
  public long subtotalMinor;
  public long taxMinor;
  public long totalMinor;
  public String status = "DRAFT";
  public LocalDate expiresOn;
  public int revision = 1;
  @Column(length=1200) public String notes;
}

@Entity @Table(name="brands", indexes=@Index(name="idx_brand_name", columnList="name"))
class Brand extends BaseEntity {
  @Column(unique=true, nullable=false) public String name;
  public String code;
  public String logoUrl;
  public String website;
  public String contactEmail;
  public String contactPhone;
  public String country = "United Kingdom";
  @Column(length=2000) public String description;
  public String status = "ACTIVE"; // ACTIVE, INACTIVE
  public Integer sortOrder = 0;
}

@Entity @Table(name="commerce_orders")
class CommerceOrder extends BaseEntity {
  @Column(unique=true) public String orderNumber;
  public String customerName;
  public String customerEmail;
  public String customerPhone;
  public long totalMinor;
  public String orderStatus = "PROCESSING";
  public String paymentStatus = "PENDING";
  public String fulfilmentStatus = "UNFULFILLED";
  public String channel = "ADMIN";
  public String warehouse = "Main Warehouse";
  public String carrier = "DPD Express";
  public String trackingNumber;
  public String estimatedDelivery;
  public String deliveryAddress;
  public String discountCode;
  public Long discountMinor = 0L;
  @Column(length=4000) public String itemsJson;
}

@Entity @Table(name="promotions")
class Promotion extends BaseEntity {
  @Column(unique=true, nullable=false) public String code;
  public String label;
  public String discountType = "PERCENT"; // PERCENT, FIXED, FREE_SHIPPING
  public long discountValue; // percentage (e.g. 10) or minor units (£20 = 2000)
  public long minBasketMinor;
  public boolean active = true;
  public LocalDate expiresOn;
  public int usageCount;
}

@Entity @Table(name="customer_inquiries")
class CustomerInquiry extends BaseEntity {
  public String ticketNumber;
  public String name;
  public String email;
  public String phone;
  public String category = "General Inquiry";
  public String orderNumber;
  public String productSku;
  public String productName;
  public String attachmentUrl;
  public String attachmentFilename;
  @Column(length=4000) public String message;
  public String status = "NEW"; // NEW, IN_PROGRESS, RESOLVED, CLOSED
  @Column(length=1000) public String resolutionNotes;
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
  @Column(length=32000) public String body;
  public String seoTitle;
  public String metaDescription;
  public Instant publishedAt;
  public String pdfUrl;
  public String pdfFilename;
  public String tag;
  public String imageUrl;
  public String buttonText;
  public String linkUrl;
  public Integer sortOrder = 0;
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

@Entity @Table(name="product_reviews")
class ProductReview extends BaseEntity {
  public Long storeReviewId;
  public Long productId;
  public String productSku;
  public String category;
  public String author;
  public String authorEmail;
  public String customerKey;
  public String location;
  public String role = "Verified Homeowner";
  public Integer rating = 5;
  public String title;
  @Column(length=4000) public String comment;
  public String status = "PENDING_APPROVAL"; // PENDING_APPROVAL, APPROVED, REJECTED
  public Boolean verifiedPurchase = true;
  public Integer helpfulCount = 0;
}

@Entity @Table(name="blog_posts", indexes={
  @Index(name="idx_admin_blog_slug", columnList="slug"),
  @Index(name="idx_admin_blog_status", columnList="status")
})
class BlogPost extends BaseEntity {
  @Column(unique=true, nullable=false) public String slug;
  @Column(nullable=false, length=500) public String title;
  @Column(length=2000) public String excerpt;
  @Column(length=32000) public String content;
  public String coverImage;
  public String category = "Heating Advice";
  public String tags = "Heating Advice";
  public String author = "Ant Langston";
  public Integer readTimeMinutes = 5;
  public String publishedAt = "2026-10-06";
  public String status = "PUBLISHED"; // PUBLISHED, DRAFT
}

@Entity @Table(name="navigation_menus", indexes=@Index(name="idx_nav_menu_id", columnList="menuId"))
class NavigationMenu extends BaseEntity {
  @Column(unique=true, nullable=false) public String menuId;
  @Column(nullable=false) public String title;
  public String category;
  public String icon;
  public String badge;
  public String imageUrl;
  @Column(length=2000) public String description;
  public Integer sortOrder = 0;
  public String status = "PUBLISHED"; // PUBLISHED, DRAFT
  @Column(columnDefinition="LONGTEXT") public String filterOptionsJson;
  @Column(columnDefinition="LONGTEXT") public String columnsJson;
  @Column(columnDefinition="LONGTEXT") public String featuredPromoJson;
}

