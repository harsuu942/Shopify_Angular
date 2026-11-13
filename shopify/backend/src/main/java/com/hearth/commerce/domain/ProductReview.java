package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "product_reviews")
public class ProductReview {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  private Long productId;
  private String productSku;
  private String category;
  private String author;
  private String authorEmail;
  private String customerKey;
  private String location;
  private String role = "Verified Homeowner";
  private Integer rating = 5;
  private String title;

  @Column(length = 4000)
  private String comment;

  private String status = "APPROVED"; // APPROVED, PENDING_APPROVAL, REJECTED
  private Boolean verifiedPurchase = true;
  private Integer helpfulCount = 0;
  private Instant createdAt = Instant.now();

  public ProductReview() {}

  public ProductReview(Long productId, String productSku, String category, String author, String location,
                       String role, Integer rating, String title, String comment, Boolean verifiedPurchase) {
    this(productId, productSku, category, author, null, null, location, role, rating, title, comment, "APPROVED", verifiedPurchase);
  }

  public ProductReview(Long productId, String productSku, String category, String author, String authorEmail,
                       String customerKey, String location, String role, Integer rating, String title,
                       String comment, String status, Boolean verifiedPurchase) {
    this.productId = productId;
    this.productSku = productSku;
    this.category = (category == null || category.isBlank()) ? "General" : category;
    this.author = (author == null || author.isBlank()) ? "Verified Customer" : author;
    this.authorEmail = authorEmail;
    this.customerKey = customerKey;
    this.location = (location == null || location.isBlank()) ? "United Kingdom" : location;
    this.role = (role == null || role.isBlank()) ? "Verified Homeowner" : role;
    this.rating = (rating == null || rating < 1) ? 5 : Math.min(rating, 5);
    this.title = title;
    this.comment = comment;
    this.status = (status == null || status.isBlank()) ? "PENDING_APPROVAL" : status.toUpperCase();
    this.verifiedPurchase = verifiedPurchase != null ? verifiedPurchase : true;
    this.helpfulCount = 0;
    this.createdAt = Instant.now();
  }

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }

  public Long getProductId() { return productId; }
  public void setProductId(Long productId) { this.productId = productId; }

  public String getProductSku() { return productSku; }
  public void setProductSku(String productSku) { this.productSku = productSku; }

  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }

  public String getAuthor() { return author; }
  public void setAuthor(String author) { this.author = author; }

  public String getAuthorEmail() { return authorEmail; }
  public void setAuthorEmail(String authorEmail) { this.authorEmail = authorEmail; }

  public String getCustomerKey() { return customerKey; }
  public void setCustomerKey(String customerKey) { this.customerKey = customerKey; }

  public String getLocation() { return location; }
  public void setLocation(String location) { this.location = location; }

  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }

  public Integer getRating() { return rating; }
  public void setRating(Integer rating) { this.rating = rating; }

  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }

  public String getComment() { return comment; }
  public void setComment(String comment) { this.comment = comment; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = (status != null) ? status.toUpperCase() : "PENDING_APPROVAL"; }

  public Boolean getVerifiedPurchase() { return verifiedPurchase; }
  public void setVerifiedPurchase(Boolean verifiedPurchase) { this.verifiedPurchase = verifiedPurchase; }

  public Integer getHelpfulCount() { return helpfulCount; }
  public void setHelpfulCount(Integer helpfulCount) { this.helpfulCount = helpfulCount; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
