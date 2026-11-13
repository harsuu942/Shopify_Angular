package com.hearth.commerce.domain;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
public class ProductVariant {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="product_id") @JsonIgnore private Product product;
  @Column(unique=true,nullable=false) private String ean;
  @Column(unique=true,nullable=false) private String variantSku;
  private String configCode,colour,baseColour,colourCode,paintType,panel,availability,productionTime,leadTime,image;
  private Integer heightMm,widthMm,depthMm,stock,watts,btu,warrantyYears,discountPercent;
  private BigDecimal price;
  private boolean unlimitedStock;
  @Column(length=4000) private String imageUrlsJson;
  public ProductVariant(){}
  public void resetId(){id=null;} public void setProduct(Product product){this.product=product;}
  public Long getId(){return id;}public String getEan(){return ean;}public String getVariantSku(){return variantSku;}public String getConfigCode(){return configCode;}public String getColour(){return colour;}public String getBaseColour(){return baseColour;}public String getColourCode(){return colourCode;}public String getPaintType(){return paintType;}public Integer getHeightMm(){return heightMm;}public Integer getWidthMm(){return widthMm;}public Integer getDepthMm(){return depthMm;}public String getPanel(){return panel;}public BigDecimal getPrice(){return price;}public Integer getStock(){return stock;}public void setStock(Integer stock){this.stock=stock;}public String getAvailability(){return availability;}public String getProductionTime(){return productionTime;}public String getLeadTime(){return leadTime;}public Integer getWatts(){return watts;}public Integer getBtu(){return btu;}public Integer getWarrantyYears(){return warrantyYears;}public String getImage(){return image;}
  public Integer getDiscountPercent(){return discountPercent!=null?discountPercent:0;} public void setDiscountPercent(Integer d){this.discountPercent=d!=null?d:0;}
  public boolean isUnlimitedStock(){return unlimitedStock;} public void setUnlimitedStock(boolean u){this.unlimitedStock=u;}
  public String getImageUrlsJson(){return imageUrlsJson;} public void setImageUrlsJson(String j){this.imageUrlsJson=j;}
  public void copyFrom(ProductVariant v){ean=v.ean;variantSku=v.variantSku;configCode=v.configCode;colour=v.colour;baseColour=v.baseColour;colourCode=v.colourCode;paintType=v.paintType;heightMm=v.heightMm;widthMm=v.widthMm;depthMm=v.depthMm;panel=v.panel;price=v.price;stock=v.stock;availability=v.availability;productionTime=v.productionTime;leadTime=v.leadTime;watts=v.watts;btu=v.btu;warrantyYears=v.warrantyYears;image=v.image;unlimitedStock=v.unlimitedStock;imageUrlsJson=v.imageUrlsJson;discountPercent=v.discountPercent!=null?v.discountPercent:0;}
}
