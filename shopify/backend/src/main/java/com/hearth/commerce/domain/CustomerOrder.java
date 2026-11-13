package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name="customer_orders")
public class CustomerOrder {
  @Id @GeneratedValue(strategy=GenerationType.UUID) private String id;
  @Column(unique=true) private String orderNumber;
  @Column(nullable=false) private String customerEmail;
  private String customerName;
  private String customerPhone;
  @Column(length=4000,nullable=false) private String itemsJson;
  @Column(nullable=false) private BigDecimal total;
  @Column(nullable=false) private String status;
  private String fulfilmentStatus = "UNFULFILLED";
  private String carrier = "DPD Express";
  private String trackingNumber;
  private String estimatedDelivery;
  private String discountCode;
  private BigDecimal discountAmount = BigDecimal.ZERO;
  private String paymentMethod = "STRIPE";
  private String paymentStatus = "PAID";
  @com.fasterxml.jackson.annotation.JsonIgnore private String stripePaymentIntentId;
  @com.fasterxml.jackson.annotation.JsonIgnore private String stripeClientSecret;
  @Column(nullable=false) private Instant createdAt;
  private String shippingAddress;

  protected CustomerOrder(){}
  public CustomerOrder(String email,String itemsJson,BigDecimal total,String address){
    this("ORD-2026-" + String.format("%05d", (int)(Math.random()*90000)+10000), email, email, "", itemsJson, total, address, null, BigDecimal.ZERO, "STRIPE", "PAID", null);
  }
  public CustomerOrder(String orderNumber, String email, String name, String phone, String itemsJson, BigDecimal total, String address, String discountCode, BigDecimal discountAmount){
    this(orderNumber, email, name, phone, itemsJson, total, address, discountCode, discountAmount, "STRIPE", "PAID", null);
  }
  public CustomerOrder(String orderNumber, String email, String name, String phone, String itemsJson, BigDecimal total, String address, String discountCode, BigDecimal discountAmount, String paymentMethod, String paymentStatus, String stripePaymentIntentId){
    this.orderNumber = orderNumber;
    this.customerEmail = email;
    this.customerName = name;
    this.customerPhone = phone;
    this.itemsJson = itemsJson;
    this.total = total;
    this.shippingAddress = address;
    this.discountCode = discountCode;
    this.discountAmount = discountAmount == null ? BigDecimal.ZERO : discountAmount;
    this.paymentMethod = (paymentMethod != null && !paymentMethod.isBlank()) ? paymentMethod : "STRIPE";
    this.paymentStatus = (paymentStatus != null && !paymentStatus.isBlank()) ? paymentStatus : "PAID";
    this.stripePaymentIntentId = stripePaymentIntentId;
    this.status = "PROCESSING";
    this.fulfilmentStatus = "UNFULFILLED";
    this.carrier = "DPD Express";
    this.trackingNumber = "DPD-GB-" + String.format("%08d", Math.abs(orderNumber.hashCode() % 100000000));
    this.estimatedDelivery = java.time.LocalDate.now().plusDays(2).toString();
    this.createdAt = Instant.now();
  }

  public String getId(){return id;}
  public String getOrderNumber(){return orderNumber == null ? "ORD-" + (id == null ? "00000" : id.substring(0, Math.min(8, id.length())).toUpperCase()) : orderNumber;}
  public void setOrderNumber(String orderNumber){this.orderNumber=orderNumber;}
  public String getCustomerEmail(){return customerEmail;}
  public String getCustomerName(){return customerName;}
  public void setCustomerName(String customerName){this.customerName=customerName;}
  public String getCustomerPhone(){return customerPhone;}
  public void setCustomerPhone(String customerPhone){this.customerPhone=customerPhone;}
  public String getItemsJson(){return itemsJson;}
  public BigDecimal getTotal(){return total;}
  public String getStatus(){return status;}
  public void setStatus(String status){this.status=status;}
  public String getFulfilmentStatus(){return fulfilmentStatus;}
  public void setFulfilmentStatus(String fulfilmentStatus){this.fulfilmentStatus=fulfilmentStatus;}
  public String getCarrier(){return carrier;}
  public void setCarrier(String carrier){this.carrier=carrier;}
  public String getTrackingNumber(){return trackingNumber;}
  public void setTrackingNumber(String trackingNumber){this.trackingNumber=trackingNumber;}
  public String getEstimatedDelivery(){return estimatedDelivery;}
  public void setEstimatedDelivery(String estimatedDelivery){this.estimatedDelivery=estimatedDelivery;}
  public String getDiscountCode(){return discountCode;}
  public BigDecimal getDiscountAmount(){return discountAmount;}
  public Instant getCreatedAt(){return createdAt;}
  public String getShippingAddress(){return shippingAddress;}
  public String getPaymentMethod(){return paymentMethod;}
  public void setPaymentMethod(String paymentMethod){this.paymentMethod=paymentMethod;}
  public String getPaymentStatus(){return paymentStatus;}
  public void setPaymentStatus(String paymentStatus){this.paymentStatus=paymentStatus;}
  public String getStripePaymentIntentId(){return stripePaymentIntentId;}
  public void setStripePaymentIntentId(String stripePaymentIntentId){this.stripePaymentIntentId=stripePaymentIntentId;}
  public String getStripeClientSecret(){return stripeClientSecret;}
  public void setStripeClientSecret(String stripeClientSecret){this.stripeClientSecret=stripeClientSecret;}
}
