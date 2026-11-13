package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.*;

@Entity
public class Product {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(unique=true,nullable=false) private String sku;
  @Column(nullable=false,length=500) private String name;
  private String brand;
  private String category;
  @Column(length=4000) private String description;
  private BigDecimal price;
  private int stock;
  private String colour;
  private String finish;
  private int warrantyYears;
  private int watts;
  private int btu;
  private String image;
  private boolean unlimitedStock;
  private String staticContentSlug;
  @Column(length=4000) private String documentsJson;
  private Integer discountPercent = 20;
  @OneToMany(mappedBy="product",cascade=CascadeType.ALL,orphanRemoval=true,fetch=FetchType.EAGER) @OrderBy("id asc") private List<ProductVariant> variants=new ArrayList<>();
  public Product() {}
  public Product(String sku,String name,String brand,String category,String description,BigDecimal price,int stock,String colour,String finish,int warrantyYears,int watts,int btu,String image) {
    this.sku=sku;this.name=name;this.brand=brand;this.category=category;this.description=description;this.price=price;this.stock=stock;this.colour=colour;this.finish=finish;this.warrantyYears=warrantyYears;this.watts=watts;this.btu=btu;this.image=image;
  }
  public Long getId(){return id;} public String getSku(){return sku;} public String getName(){return name;} public String getBrand(){return brand;} public String getCategory(){return category;} public String getDescription(){return description;} public BigDecimal getPrice(){return price;} public int getStock(){return stock;} public void setStock(int stock){this.stock=stock;} public String getColour(){return colour;} public String getFinish(){return finish;} public int getWarrantyYears(){return warrantyYears;} public int getWatts(){return watts;} public int getBtu(){return btu;} public String getImage(){return image;}
  public boolean isUnlimitedStock(){return unlimitedStock;} public void setUnlimitedStock(boolean u){this.unlimitedStock=u;}
  public String getStaticContentSlug(){return staticContentSlug;} public void setStaticContentSlug(String s){this.staticContentSlug=s;}
  public String getDocumentsJson(){return documentsJson;} public void setDocumentsJson(String d){this.documentsJson=d;}
  public Integer getDiscountPercent(){return discountPercent!=null?discountPercent:20;} public void setDiscountPercent(Integer d){this.discountPercent=d!=null?d:20;}
  public List<ProductVariant> getVariants(){return variants;}
  public void apply(String sku,String name,String brand,String category,String description,BigDecimal price,int stock,String colour,String finish,int warrantyYears,int watts,int btu,String image,boolean unlimitedStock,String staticContentSlug,String documentsJson,Integer discountPercent,List<ProductVariant> incoming){
    this.sku=sku;this.name=name;this.brand=brand;this.category=category;this.description=description;this.price=price;this.stock=stock;this.colour=colour;this.finish=finish;this.warrantyYears=warrantyYears;this.watts=watts;this.btu=btu;this.image=image;
    this.unlimitedStock=unlimitedStock;this.staticContentSlug=staticContentSlug;this.documentsJson=documentsJson;
    this.discountPercent=discountPercent!=null?discountPercent:20;
    var byEan=new HashMap<String,ProductVariant>();var bySku=new HashMap<String,ProductVariant>();
    for(var current:variants){if(current.getEan()!=null)byEan.put(current.getEan(),current);if(current.getVariantSku()!=null)bySku.put(current.getVariantSku(),current);}
    var reconciled=new ArrayList<ProductVariant>();
    if(incoming!=null)for(var supplied:incoming){var target=byEan.get(supplied.getEan());if(target==null)target=bySku.get(supplied.getVariantSku());if(target==null)target=supplied;else target.copyFrom(supplied);target.setProduct(this);reconciled.add(target);}
    variants.clear();variants.addAll(reconciled);
  }
}
