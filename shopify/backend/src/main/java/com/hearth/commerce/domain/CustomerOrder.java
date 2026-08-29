package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name="customer_orders")
public class CustomerOrder {
  @Id @GeneratedValue(strategy=GenerationType.UUID) private String id;
  @Column(nullable=false) private String customerEmail;
  @Column(length=4000,nullable=false) private String itemsJson;
  @Column(nullable=false) private BigDecimal total;
  @Column(nullable=false) private String status;
  @Column(nullable=false) private Instant createdAt;
  private String shippingAddress;
  protected CustomerOrder(){}
  public CustomerOrder(String email,String itemsJson,BigDecimal total,String address){customerEmail=email;this.itemsJson=itemsJson;this.total=total;shippingAddress=address;status="CONFIRMED";createdAt=Instant.now();}
  public String getId(){return id;} public String getCustomerEmail(){return customerEmail;} public String getItemsJson(){return itemsJson;} public BigDecimal getTotal(){return total;} public String getStatus(){return status;} public Instant getCreatedAt(){return createdAt;} public String getShippingAddress(){return shippingAddress;}
}
