package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="customer_inquiries")
public class CustomerInquiry {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  private String ticketNumber;
  private String name;
  private String email;
  private String phone;
  private String category = "General Inquiry";
  private String orderNumber;
  private String productSku;
  private String productName;
  private String attachmentUrl;
  private String attachmentFilename;
  @Column(length=4000) private String message;
  private String status = "NEW";
  @Column(length=1000) private String resolutionNotes;
  private Instant createdAt = Instant.now();

  public CustomerInquiry(){}
  public CustomerInquiry(String name, String email, String phone, String category, String message){
    this("TKT-2026-" + String.format("%05d", (int)(Math.random() * 90000) + 10000), name, email, phone, category, null, null, null, null, null, message);
  }

  public CustomerInquiry(String ticketNumber, String name, String email, String phone, String category,
                         String orderNumber, String productSku, String productName,
                         String attachmentUrl, String attachmentFilename, String message){
    this.ticketNumber = ticketNumber != null && !ticketNumber.isBlank() ? ticketNumber : "TKT-2026-" + String.format("%05d", (int)(Math.random() * 90000) + 10000);
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.category = category == null || category.isBlank() ? "General Inquiry" : category;
    this.orderNumber = orderNumber;
    this.productSku = productSku;
    this.productName = productName;
    this.attachmentUrl = attachmentUrl;
    this.attachmentFilename = attachmentFilename;
    this.message = message;
    this.status = "NEW";
    this.createdAt = Instant.now();
  }

  public Long getId(){return id;}
  public String getTicketNumber(){return ticketNumber;}
  public void setTicketNumber(String ticketNumber){this.ticketNumber=ticketNumber;}
  public String getName(){return name;}
  public void setName(String name){this.name=name;}
  public String getEmail(){return email;}
  public void setEmail(String email){this.email=email;}
  public String getPhone(){return phone;}
  public void setPhone(String phone){this.phone=phone;}
  public String getCategory(){return category;}
  public void setCategory(String category){this.category=category;}
  public String getOrderNumber(){return orderNumber;}
  public void setOrderNumber(String orderNumber){this.orderNumber=orderNumber;}
  public String getProductSku(){return productSku;}
  public void setProductSku(String productSku){this.productSku=productSku;}
  public String getProductName(){return productName;}
  public void setProductName(String productName){this.productName=productName;}
  public String getAttachmentUrl(){return attachmentUrl;}
  public void setAttachmentUrl(String attachmentUrl){this.attachmentUrl=attachmentUrl;}
  public String getAttachmentFilename(){return attachmentFilename;}
  public void setAttachmentFilename(String attachmentFilename){this.attachmentFilename=attachmentFilename;}
  public String getMessage(){return message;}
  public void setMessage(String message){this.message=message;}
  public String getStatus(){return status;}
  public void setStatus(String status){this.status=status;}
  public String getResolutionNotes(){return resolutionNotes;}
  public void setResolutionNotes(String resolutionNotes){this.resolutionNotes=resolutionNotes;}
  public Instant getCreatedAt(){return createdAt;}
}
