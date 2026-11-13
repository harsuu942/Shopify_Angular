package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity @Table(name="promotions")
public class Promotion {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(unique=true, nullable=false) private String code;
  private String label;
  private String discountType = "PERCENT";
  private long discountValue;
  private long minBasketMinor;
  private boolean active = true;
  private LocalDate expiresOn;

  public Promotion(){}
  public Promotion(String code, String label, String discountType, long discountValue, long minBasketMinor, boolean active, LocalDate expiresOn){
    this.code = code == null ? "" : code.toUpperCase().trim();
    this.label = label;
    this.discountType = discountType;
    this.discountValue = discountValue;
    this.minBasketMinor = minBasketMinor;
    this.active = active;
    this.expiresOn = expiresOn;
  }

  public Long getId(){return id;}
  public String getCode(){return code;}
  public void setCode(String code){this.code = code == null ? "" : code.toUpperCase().trim();}
  public String getLabel(){return label;}
  public void setLabel(String label){this.label=label;}
  public String getDiscountType(){return discountType;}
  public void setDiscountType(String discountType){this.discountType=discountType;}
  public long getDiscountValue(){return discountValue;}
  public void setDiscountValue(long discountValue){this.discountValue=discountValue;}
  public long getMinBasketMinor(){return minBasketMinor;}
  public void setMinBasketMinor(long minBasketMinor){this.minBasketMinor=minBasketMinor;}
  public boolean isActive(){return active;}
  public void setActive(boolean active){this.active=active;}
  public LocalDate getExpiresOn(){return expiresOn;}
  public void setExpiresOn(LocalDate expiresOn){this.expiresOn=expiresOn;}
}
