package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
public class Product {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(unique=true,nullable=false) private String sku;
  @Column(nullable=false) private String name;
  private String brand;
  private String category;
  @Column(length=1200) private String description;
  private BigDecimal price;
  private int stock;
  private String colour;
  private String finish;
  private int warrantyYears;
  private int watts;
  private int btu;
  private String image;
  public Product() {}
  public Product(String sku,String name,String brand,String category,String description,BigDecimal price,int stock,String colour,String finish,int warrantyYears,int watts,int btu,String image) {
    this.sku=sku;this.name=name;this.brand=brand;this.category=category;this.description=description;this.price=price;this.stock=stock;this.colour=colour;this.finish=finish;this.warrantyYears=warrantyYears;this.watts=watts;this.btu=btu;this.image=image;
  }
  public Long getId(){return id;} public String getSku(){return sku;} public String getName(){return name;} public String getBrand(){return brand;} public String getCategory(){return category;} public String getDescription(){return description;} public BigDecimal getPrice(){return price;} public int getStock(){return stock;} public String getColour(){return colour;} public String getFinish(){return finish;} public int getWarrantyYears(){return warrantyYears;} public int getWatts(){return watts;} public int getBtu(){return btu;} public String getImage(){return image;}
}
