package com.hearth.commerce.api;

import com.hearth.commerce.domain.*;
import com.hearth.commerce.repo.ProductRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;
import com.hearth.commerce.repo.*;

@RestController @RequestMapping("/api/internal")
public class CatalogueSyncController {
  private final ProductRepository products;
  private final OrderRepository orders;
  private final PromotionRepository promotions;
  private final CustomerInquiryRepository inquiries;
  private final String secret;

  CatalogueSyncController(ProductRepository products, OrderRepository orders, PromotionRepository promotions, CustomerInquiryRepository inquiries, @Value("${app.catalogue-sync-secret}") String secret){
    this.products=products;
    this.orders=orders;
    this.promotions=promotions;
    this.inquiries=inquiries;
    this.secret=secret;
  }

  @PostMapping("/catalogue/sync") @Transactional ResponseEntity<Void> sync(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,@RequestBody SyncProduct source){
    if(!constantTime(secret,supplied))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    if(source.archived()||!"PUBLISHED".equalsIgnoreCase(source.status())){products.findBySku(source.sku()).ifPresent(products::delete);return ResponseEntity.noContent().build();}
    Product target=products.findBySku(source.sku()).orElseGet(Product::new);var variants=Optional.ofNullable(source.variants()).orElse(List.of()).stream().map(this::variant).toList();
    var primary=variants.stream().findFirst();
    target.apply(source.sku(),source.name(),source.brand(),source.category(),source.description(),money(source.priceMinor()),source.stock(),primary.map(ProductVariant::getColour).orElse(""),primary.map(ProductVariant::getPaintType).orElse(""),primary.map(v->Optional.ofNullable(v.getWarrantyYears()).orElse(0)).orElse(0),primary.map(v->Optional.ofNullable(v.getWatts()).orElse(0)).orElse(0),primary.map(v->Optional.ofNullable(v.getBtu()).orElse(0)).orElse(0),source.imageUrl(),source.unlimitedStock(),source.staticContentSlug(),source.documentsJson(),source.discountPercent(),variants);
    products.save(target);return ResponseEntity.noContent().build();
  }

  @PostMapping("/orders/status-update") @Transactional
  public ResponseEntity<Map<String,Object>> updateOrderStatus(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                                              @RequestBody Map<String,String> body){
    if(!constantTime(secret,supplied)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    String orderNum = body.get("orderNumber");
    if(orderNum == null || orderNum.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"orderNumber required");
    String cleanNum = orderNum.trim();
    if(cleanNum.startsWith("#")) cleanNum = cleanNum.substring(1).trim();
    var found = orders.findByOrderNumber(cleanNum);
    if(found.isEmpty()) found = orders.findByTrackingNumber(cleanNum);
    if(found.isEmpty()) found = orders.findById(cleanNum);
    if(found.isPresent()){
      var o = found.get();
      if(body.containsKey("orderStatus")) o.setStatus(body.get("orderStatus"));
      if(body.containsKey("fulfilmentStatus")) o.setFulfilmentStatus(body.get("fulfilmentStatus"));
      if(body.containsKey("carrier")) o.setCarrier(body.get("carrier"));
      if(body.containsKey("trackingNumber")) o.setTrackingNumber(body.get("trackingNumber"));
      if(body.containsKey("estimatedDelivery")) o.setEstimatedDelivery(body.get("estimatedDelivery"));
      orders.save(o);
      return ResponseEntity.ok(Map.of("success",true,"orderNumber",o.getOrderNumber(),"status",o.getStatus(),"trackingNumber",o.getTrackingNumber()));
    }
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error","Order not found"));
  }

  @PostMapping("/promotions/sync") @Transactional
  public ResponseEntity<Map<String,Object>> syncPromotion(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                                          @RequestBody Promotion promo){
    if(!constantTime(secret,supplied)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    if(promo.getCode() == null || promo.getCode().isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"code required");
    var existing = promotions.findByCodeIgnoreCase(promo.getCode().trim()).orElseGet(Promotion::new);
    existing.setCode(promo.getCode().trim().toUpperCase());
    existing.setLabel(promo.getLabel());
    existing.setDiscountType(promo.getDiscountType());
    existing.setDiscountValue(promo.getDiscountValue());
    existing.setMinBasketMinor(promo.getMinBasketMinor());
    existing.setActive(promo.isActive());
    existing.setExpiresOn(promo.getExpiresOn());
    promotions.save(existing);
    return ResponseEntity.ok(Map.of("success",true,"code",existing.getCode()));
  }

  @PostMapping("/inquiries/status-update") @Transactional
  public ResponseEntity<Map<String,Object>> updateInquiryStatus(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                                                @RequestBody Map<String,Object> body){
    if(!constantTime(secret,supplied)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    String ticketNumber = Optional.ofNullable(body.get("ticketNumber")).map(Object::toString).orElse("");
    Long id = body.get("id") != null ? Long.valueOf(body.get("id").toString()) : null;
    Optional<CustomerInquiry> found = Optional.empty();
    if (!ticketNumber.isBlank()) {
      found = inquiries.findByTicketNumber(ticketNumber.trim());
    }
    if (found.isEmpty() && id != null) {
      found = inquiries.findById(id);
    }
    if (found.isPresent()) {
      var inq = found.get();
      if (body.containsKey("status")) inq.setStatus(String.valueOf(body.get("status")));
      if (body.containsKey("notes")) inq.setResolutionNotes(String.valueOf(body.get("notes")));
      inquiries.save(inq);
      return ResponseEntity.ok(Map.of("success", true, "id", inq.getId(), "status", inq.getStatus()));
    }
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Inquiry not found"));
  }
  private ProductVariant variant(SyncVariant s){var v=new ProductVariant();set(v,"ean",s.ean());set(v,"variantSku",s.variantSku());set(v,"configCode",s.configCode());set(v,"colour",s.colour());set(v,"baseColour",s.baseColour());set(v,"colourCode",s.colourCode());set(v,"paintType",s.paintType());set(v,"heightMm",s.heightMm());set(v,"widthMm",s.widthMm());set(v,"depthMm",s.depthMm());set(v,"panel",s.panel());set(v,"price",money(s.priceMinor()));set(v,"stock",s.stock());set(v,"availability",s.availability());set(v,"productionTime",s.productionTime());set(v,"leadTime",s.leadTime());set(v,"watts",s.watts());set(v,"btu",s.btu());set(v,"warrantyYears",s.warrantyYears());set(v,"image",s.imageUrl());set(v,"unlimitedStock",s.unlimitedStock());set(v,"imageUrlsJson",s.imageUrlsJson());set(v,"discountPercent",s.discountPercent()!=null?s.discountPercent():0);return v;}
  private void set(Object target,String field,Object value){try{var f=target.getClass().getDeclaredField(field);f.setAccessible(true);f.set(target,value);}catch(Exception e){throw new IllegalStateException(e);}}
  private BigDecimal money(Long minor){return BigDecimal.valueOf(Optional.ofNullable(minor).orElse(0L),2);}
  private boolean constantTime(String a,String b){if(a==null||b==null)return false;return java.security.MessageDigest.isEqual(a.getBytes(java.nio.charset.StandardCharsets.UTF_8),b.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
  record SyncProduct(String sku,String name,String brand,String category,String description,long priceMinor,int stock,String status,boolean archived,String imageUrl,boolean unlimitedStock,String staticContentSlug,String documentsJson,Integer discountPercent,List<SyncVariant> variants){}
  record SyncVariant(String ean,String variantSku,String configCode,String colour,String baseColour,String colourCode,String paintType,Integer heightMm,Integer widthMm,Integer depthMm,String panel,Long priceMinor,Integer stock,String availability,String productionTime,String leadTime,Integer watts,Integer btu,Integer warrantyYears,String imageUrl,boolean unlimitedStock,String imageUrlsJson,Integer discountPercent){}
}
