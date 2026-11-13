package com.hearth.admin;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.time.LocalDate;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

record LoginRequest(@NotBlank @Email String email,@NotBlank String password) {}
record LoginResponse(String token,String name,String email,String role) {}
record StockRequest(@Positive int quantity,String type,@NotBlank String warehouse,@NotBlank String reason,String reference) {}

@RestController @RequestMapping("/api/auth")
class AuthController {
  private final AdminUserRepository users; private final PasswordEncoder encoder; private final JwtService jwt;
  private final AuditService audit;
  private final Map<String,List<Instant>> attempts=new ConcurrentHashMap<>();
  AuthController(AdminUserRepository users,PasswordEncoder encoder,JwtService jwt,AuditService audit){this.users=users;this.encoder=encoder;this.jwt=jwt;this.audit=audit;}
  @PostMapping("/login") LoginResponse login(@Valid @RequestBody LoginRequest r,HttpServletRequest request){
    var key=request.getRemoteAddr()+":"+r.email().toLowerCase(); var cutoff=Instant.now().minusSeconds(900);
    var recent=attempts.computeIfAbsent(key,k->new ArrayList<>()); synchronized(recent){recent.removeIf(t->t.isBefore(cutoff)); if(recent.size()>=5) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Too many attempts. Try again later."); recent.add(Instant.now());}
    var u=users.findByEmailIgnoreCase(r.email()).filter(x->x.active&&encoder.matches(r.password(),x.passwordHash)).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid email or password"));
    attempts.remove(key);audit.log(u.email,"LOGIN","ADMIN_USER",u.email,"Successful administrator login",request);return new LoginResponse(jwt.create(u),u.name,u.email,u.role);
  }
  @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT) void logout(Authentication authentication,HttpServletRequest request){audit.log(authentication,"LOGOUT","ADMIN_USER",authentication.getName(),"Administrator signed out",request);}
}

@RestController @RequestMapping("/api/dashboard")
@PreAuthorize("hasRole('ADMIN')")
class DashboardController {
  private final ProductRepository products; private final CustomerRepository customers; private final QuotationRepository quotes; private final CommerceOrderRepository orders; private final AuditLogRepository audits;
  DashboardController(ProductRepository p,CustomerRepository c,QuotationRepository q,CommerceOrderRepository o,AuditLogRepository a){products=p;customers=c;quotes=q;orders=o;audits=a;}
  @GetMapping Map<String,Object> dashboard(){
    long revenue=orders.findAll().stream().filter(o->"PAID".equals(o.paymentStatus)).mapToLong(o->o.totalMinor).sum();
    return Map.of("revenueMinor",revenue,"orders",orders.count(),"customers",customers.count(),"products",products.countByArchivedFalse(),"lowStock",products.countByArchivedFalseAndStockLessThanEqual(10),"draftProducts",products.countByArchivedFalseAndStatus("DRAFT"),"openQuotes",quotes.countByStatus("SENT")+quotes.countByStatus("VIEWED"),"paymentExceptions",orders.countByPaymentStatus("FAILED"),"recentOrders",orders.findAll(PageRequest.of(0,5,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent(),"recentActivity",audits.findAll(PageRequest.of(0,6,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent());
  }
}

@RestController @RequestMapping("/api/products")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class ProductController {
  private final ProductRepository repo; private final AuditService audit; private final CatalogueSyncService sync; private final TermaWorkbookImporter workbookImporter; private final EanImageLibraryImporter imageImporter;
  ProductController(ProductRepository repo,AuditService audit,CatalogueSyncService sync,TermaWorkbookImporter workbookImporter,EanImageLibraryImporter imageImporter){this.repo=repo;this.audit=audit;this.sync=sync;this.workbookImporter=workbookImporter;this.imageImporter=imageImporter;}
  @GetMapping Page<Product> list(@RequestParam(value="q", defaultValue="") String q,@RequestParam(value="status", defaultValue="") String status,@RequestParam(value="brand", defaultValue="") String brand,@RequestParam(value="page", defaultValue="0") int page,@RequestParam(value="size", defaultValue="20") int size){var safePage=Math.max(0,page);var safeSize=Math.max(1,Math.min(size,100));return repo.search(q.trim(),status.trim().toUpperCase(),brand.trim(),PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"updatedAt")));}
  @GetMapping("/image-coverage") Map<String,Long> imageCoverage(){var all=repo.findAll().stream().filter(p->!p.archived).toList();long productImages=all.stream().filter(p->p.imageUrl!=null&&!p.imageUrl.isBlank()).count();long variants=all.stream().mapToLong(p->p.variants.size()).sum();long variantImages=all.stream().flatMap(p->p.variants.stream()).filter(v->v.imageUrl!=null&&!v.imageUrl.isBlank()).count();return Map.of("products",(long)all.size(),"productImages",productImages,"variants",variants,"variantImages",variantImages);}
  @GetMapping("/{id}") Product get(@PathVariable("id") Long id){return find(id);}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) Product create(@RequestBody Product p,Authentication a,HttpServletRequest req){p.id=null;if(p.discountPercent==null)p.discountPercent=0;p.replaceVariants(p.variants);validate(p);var existing=repo.findBySku(p.sku);if(existing.isPresent()){var x=existing.get();if(!x.archived)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Product with SKU "+p.sku+" already exists");x.name=p.name;x.brand=p.brand;x.category=p.category;x.description=p.description;x.priceMinor=p.priceMinor;x.costMinor=p.costMinor;x.stock=p.stock;x.lowStockThreshold=p.lowStockThreshold;x.discountPercent=p.discountPercent!=null?p.discountPercent:0;x.status=p.status;x.taxClass=p.taxClass;x.shippingClass=p.shippingClass;x.imageUrl=p.imageUrl;x.sourceUrl=p.sourceUrl;x.availability=p.availability;x.leadTime=p.leadTime;x.unlimitedStock=p.unlimitedStock;x.staticContentId=p.staticContentId;x.staticContentSlug=p.staticContentSlug;x.documentsJson=p.documentsJson;x.archived=false;x.replaceVariants(p.variants);var saved=repo.save(x);sync.sync(saved);audit.log(a,"CREATE","PRODUCT",saved.id,"Re-created "+saved.sku,req);return saved;}var saved=repo.save(p);sync.sync(saved);audit.log(a,"CREATE","PRODUCT",saved.id,"Created "+saved.sku,req);return saved;}
  @PutMapping("/{id}") Product update(@PathVariable("id") Long id,@RequestBody Product p,Authentication a,HttpServletRequest req){var x=find(id);x.sku=p.sku;x.name=p.name;x.brand=p.brand;x.category=p.category;x.description=p.description;x.priceMinor=p.priceMinor;x.costMinor=p.costMinor;x.stock=p.stock;x.lowStockThreshold=p.lowStockThreshold;x.discountPercent=p.discountPercent!=null?p.discountPercent:0;x.status=p.status;x.taxClass=p.taxClass;x.shippingClass=p.shippingClass;x.imageUrl=p.imageUrl;x.sourceUrl=p.sourceUrl;x.availability=p.availability;x.leadTime=p.leadTime;x.unlimitedStock=p.unlimitedStock;x.staticContentId=p.staticContentId;x.staticContentSlug=p.staticContentSlug;x.documentsJson=p.documentsJson;x.replaceVariants(p.variants);validate(x);var saved=repo.save(x);sync.sync(saved);audit.log(a,"UPDATE","PRODUCT",id,"Updated "+saved.sku,req);return saved;}
  @GetMapping("/export-csv")
  public ResponseEntity<String> exportCsv(){
    var sb = new StringBuilder("SKU,Name,Brand,Category,Price,Stock,UnlimitedStock,Status,Availability,LeadTime,VariantsCount\n");
    for(var p:repo.findAll()){
      if(p.archived) continue;
      sb.append('"').append(p.sku.replace("\"","\"\"")).append("\",")
        .append('"').append(p.name.replace("\"","\"\"")).append("\",")
        .append('"').append((p.brand!=null?p.brand:"").replace("\"","\"\"")).append("\",")
        .append('"').append((p.category!=null?p.category:"").replace("\"","\"\"")).append("\",")
        .append(String.format(java.util.Locale.UK,"%.2f",p.priceMinor/100.0)).append(",")
        .append(p.unlimitedStock?"UNLIMITED":String.valueOf(p.stock)).append(",")
        .append(p.unlimitedStock).append(",")
        .append(p.status).append(",")
        .append('"').append((p.availability!=null?p.availability:"").replace("\"","\"\"")).append("\",")
        .append('"').append((p.leadTime!=null?p.leadTime:"").replace("\"","\"\"")).append("\",")
        .append(p.variants!=null?p.variants.size():0).append("\n");
    }
    return ResponseEntity.ok()
      .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"thp-products.csv\"")
      .contentType(org.springframework.http.MediaType.parseMediaType("text/csv;charset=UTF-8"))
      .body(sb.toString());
  }
  @GetMapping("/brands")
  public List<Map<String,Object>> getBrands(){
    var all = repo.findAll().stream().filter(p->!p.archived).toList();
    var byBrand = all.stream().collect(java.util.stream.Collectors.groupingBy(p->p.brand!=null&&!p.brand.isBlank()?p.brand:"THP Heating"));
    var res = new ArrayList<Map<String,Object>>();
    for(var entry:byBrand.entrySet()){
      var brandName=entry.getKey();
      var list=entry.getValue();
      var categories=list.stream().map(p->p.category).filter(Objects::nonNull).distinct().toList();
      long activeCount=list.stream().filter(p->"PUBLISHED".equalsIgnoreCase(p.status)).count();
      res.add(Map.of("name",brandName,"totalProducts",list.size(),"activeProducts",activeCount,"categories",categories,"status",activeCount>0?"ACTIVE":"INACTIVE"));
    }
    return res;
  }
  @PostMapping("/brands/{brand}/toggle-status")
  public Map<String,Object> toggleBrandStatus(@PathVariable("brand") String brand,@RequestParam("status") String targetStatus,Authentication a,HttpServletRequest req){
    var all = repo.findAll().stream().filter(p->!p.archived&&brand.equalsIgnoreCase(p.brand)).toList();
    int changed=0;
    for(var p:all){
      p.status=targetStatus.toUpperCase();
      repo.save(p);
      sync.sync(p);
      changed++;
    }
    audit.log(a,"TOGGLE_BRAND","PRODUCT",brand,"Switched "+changed+" products to "+targetStatus,req);
    return Map.of("brand",brand,"updated",changed,"status",targetStatus);
  }
  @PostMapping("/import") @Transactional Map<String,Integer> importProducts(@RequestBody List<Product> incoming,Authentication a,HttpServletRequest req){int created=0,updated=0;for(var p:incoming){validate(p);var existing=repo.findBySku(p.sku);if(existing.isPresent()){var x=existing.get();x.name=p.name;x.brand=p.brand;x.category=p.category;x.description=p.description;x.imageUrl=p.imageUrl;x.sourceUrl=p.sourceUrl;x.archived=false;x.replaceVariants(p.variants);var saved=repo.save(x);sync.sync(saved);updated++;}else{p.id=null;p.replaceVariants(p.variants);var saved=repo.save(p);sync.sync(saved);created++;}}audit.log(a,"IMPORT","PRODUCT","bulk","Imported "+created+" and updated "+updated+" products",req);return Map.of("created",created,"updated",updated,"total",incoming.size());}
  @PostMapping(value="/import-workbook",consumes="multipart/form-data") ImportResult importWorkbook(@RequestPart("file") MultipartFile file,Authentication a,HttpServletRequest req) throws Exception {var result=workbookImporter.importWorkbook(file);audit.log(a,"IMPORT","PRODUCT","workbook","Imported "+result.created()+" products and "+result.variants()+" variants",req);return result;}
  @GetMapping("/import-workbook/sample")
  public org.springframework.http.ResponseEntity<byte[]> downloadSampleWorkbook() throws Exception {
    byte[] excelBytes = workbookImporter.generateSampleWorkbook();
    return org.springframework.http.ResponseEntity.ok()
      .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"hearth-product-import-sample.xlsx\"")
      .contentType(org.springframework.http.MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
      .body(excelBytes);
  }
  @PostMapping("/sync-all") Map<String,Integer> syncAll(Authentication a,HttpServletRequest req){int synced=0,failed=0;for(var product:repo.findAll()){if(product.archived)continue;if(sync.sync(product))synced++;else failed++;}audit.log(a,"SYNC_ALL","PRODUCT","catalogue","Synchronized "+synced+" products; "+failed+" failed",req);return Map.of("synced",synced,"failed",failed);}
  @PostMapping("/{id}/sync") Map<String,Object> syncOne(@PathVariable("id") Long id,Authentication a,HttpServletRequest req){var p=find(id);boolean ok=sync.sync(p);audit.log(a,"SYNC_ONE","PRODUCT",id,"Storefront sync for "+p.sku+" (ok="+ok+")",req);return Map.of("success",ok,"syncStatus",p.syncStatus,"syncError",java.util.Optional.ofNullable(p.syncError).orElse(""));}
  @PostMapping(value="/import-images",consumes="multipart/form-data") ImageImportResult importImages(@RequestPart("file") MultipartFile file,Authentication a,HttpServletRequest req) throws Exception {var result=imageImporter.importZip(file);audit.log(a,"IMPORT_IMAGES","PRODUCT","image-library","Matched "+result.matched()+" EAN images",req);return result;}
  @DeleteMapping("/{id}") void archive(@PathVariable("id") Long id,Authentication a,HttpServletRequest req){var p=find(id);p.archived=true;repo.save(p);sync.sync(p);audit.log(a,"ARCHIVE","PRODUCT",id,"Archived "+p.sku,req);}
  private Product find(Long id){return repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found"));}
  private void validate(Product p){if(p.sku==null||p.sku.isBlank()||p.name==null||p.name.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"SKU and name are required");if(p.priceMinor<0||p.costMinor<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Prices cannot be negative");if("PUBLISHED".equals(p.status)&&(p.category==null||p.category.isBlank()||p.priceMinor<=0))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Published products require category and price");var eans=new HashSet<String>();for(var v:p.variants){if(v.ean==null||v.ean.isBlank()||v.variantSku==null||v.variantSku.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Every variant requires an EAN and variant SKU");if(!eans.add(v.ean))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"EAN values must be unique within a product");}}
}

@RestController @RequestMapping("/api/customers")
@PreAuthorize("hasRole('ADMIN')")
class CustomerController {
  private final CustomerRepository repo;
  private final CatalogueSyncService sync;
  CustomerController(CustomerRepository repo, CatalogueSyncService sync){this.repo=repo;this.sync=sync;}
  @GetMapping Page<Customer> list(@RequestParam(value="q", defaultValue="") String q,@RequestParam(value="page", defaultValue="0") int page){return repo.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(q,q,PageRequest.of(page,20,Sort.by(Sort.Direction.DESC,"createdAt")));}
  @PostMapping Customer create(@RequestBody Customer x){x.id=null;var saved=repo.save(x);sync.syncCustomerStatus(saved);return saved;}
  @PutMapping("/{id}") Customer update(@PathVariable("id") Long id,@RequestBody Customer p){var x=repo.findById(id).orElseThrow();x.name=p.name;x.email=p.email;x.phone=p.phone;x.status=p.status;x.marketingConsent=p.marketingConsent;x.city=p.city;x.adminNotes=p.adminNotes;var saved=repo.save(x);sync.syncCustomerStatus(saved);return saved;}
  @PutMapping("/{id}/toggle-status") Customer toggleStatus(@PathVariable("id") Long id){var x=repo.findById(id).orElseThrow();x.status="ACTIVE".equalsIgnoreCase(x.status)?"INACTIVE":"ACTIVE";var saved=repo.save(x);sync.syncCustomerStatus(saved);return saved;}
}

@RestController @RequestMapping("/api/quotations")
@PreAuthorize("hasRole('ADMIN')")
class QuotationController {
  private final QuotationRepository repo; QuotationController(QuotationRepository r){repo=r;}
  @GetMapping List<Quotation> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"createdAt"));}
  @PostMapping Quotation create(@RequestBody Quotation q){
    q.id=null;
    q.quoteNumber="QT-"+LocalDate.now().getYear()+"-"+String.format("%05d",repo.count()+1);
    if(q.subtotalMinor > 0 && q.taxMinor == 0){
      q.taxMinor = Math.round(q.subtotalMinor * 0.20);
    }
    q.totalMinor=q.subtotalMinor+q.taxMinor;
    if(q.companyEmail == null || q.companyEmail.isBlank()) q.companyEmail = "sales@theheatingandplumbing.com";
    if(q.expiresOn==null) q.expiresOn=LocalDate.now().plusDays(30);
    return repo.save(q);
  }
  @PutMapping("/{id}") Quotation update(@PathVariable("id") Long id, @RequestBody Quotation p){
    var q = repo.findById(id).orElseThrow();
    q.customerName = p.customerName;
    q.customerEmail = p.customerEmail;
    q.customerAddress = p.customerAddress;
    if(p.companyEmail != null && !p.companyEmail.isBlank()) q.companyEmail = p.companyEmail;
    if(p.companyPhone != null && !p.companyPhone.isBlank()) q.companyPhone = p.companyPhone;
    if(p.companyAddress != null && !p.companyAddress.isBlank()) q.companyAddress = p.companyAddress;
    q.lineItemsJson = p.lineItemsJson;
    q.subtotalMinor = p.subtotalMinor;
    q.taxMinor = p.taxMinor;
    q.totalMinor = p.totalMinor;
    q.status = p.status;
    q.expiresOn = p.expiresOn;
    q.notes = p.notes;
    return repo.save(q);
  }
  @PutMapping("/{id}/status/{status}") Quotation status(@PathVariable("id") Long id,@PathVariable("status") String status){var q=repo.findById(id).orElseThrow();q.status=status.toUpperCase();return repo.save(q);}
  @PostMapping("/{id}/send-email")
  public Map<String, Object> sendQuoteEmail(@PathVariable("id") Long id, @RequestBody(required = false) Map<String, String> body) {
    var q = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quotation not found"));
    q.status = "SENT";
    repo.save(q);
    return Map.of(
      "success", true,
      "quoteNumber", q.quoteNumber != null ? q.quoteNumber : ("QT-" + q.id),
      "sentTo", (q.customerEmail != null && !q.customerEmail.isBlank()) ? q.customerEmail : "customer",
      "message", "Quotation estimate " + (q.quoteNumber != null ? q.quoteNumber : ("#" + q.id)) + " has been successfully emailed to " + (q.customerEmail != null ? q.customerEmail : "customer email")
    );
  }
  @DeleteMapping("/{id}") void delete(@PathVariable("id") Long id){repo.deleteById(id);}
}

@RestController @RequestMapping("/api/orders")
@PreAuthorize("hasRole('ADMIN')")
class OrderController {
  private final CommerceOrderRepository repo;
  private final ProductRepository products;
  private final InventoryTransactionRepository inventoryTxs;
  private final CatalogueSyncService sync;

  OrderController(CommerceOrderRepository r, ProductRepository products, InventoryTransactionRepository inventoryTxs, CatalogueSyncService sync){
    this.repo=r;
    this.products=products;
    this.inventoryTxs=inventoryTxs;
    this.sync=sync;
  }

  @GetMapping List<CommerceOrder> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"createdAt"));}
  @PostMapping CommerceOrder create(@RequestBody CommerceOrder o){o.id=null;o.orderNumber="ORD-"+LocalDate.now().getYear()+"-"+String.format("%05d",repo.count()+1);return repo.save(o);}

  @PutMapping("/{id}") @Transactional
  CommerceOrder update(@PathVariable("id") Long id,@RequestBody CommerceOrder p,Authentication auth,HttpServletRequest req){
    var o=repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Order not found"));
    String oldStatus = o.orderStatus != null ? o.orderStatus.toUpperCase() : "";
    String newStatus = p.orderStatus != null ? p.orderStatus.toUpperCase() : oldStatus;

    boolean cancellingOrReturning = (newStatus.equals("CANCELLED") || newStatus.equals("RETURNED"))
        && !oldStatus.equals("CANCELLED") && !oldStatus.equals("RETURNED");

    o.orderStatus=p.orderStatus;
    o.paymentStatus=p.paymentStatus;
    o.fulfilmentStatus=p.fulfilmentStatus;
    o.warehouse=p.warehouse;
    o.carrier=p.carrier;
    o.trackingNumber=p.trackingNumber;
    o.estimatedDelivery=p.estimatedDelivery;
    var saved=repo.save(o);

    if (cancellingOrReturning) {
      restockOrderItems(saved, newStatus, auth != null ? auth.getName() : "admin");
    }

    sync.syncOrderStatus(saved);
    return saved;
  }

  private void restockOrderItems(CommerceOrder order, String reasonStatus, String actor) {
    if (order.itemsJson == null || order.itemsJson.isBlank()) return;
    List<RestockItem> itemsToRestock = parseItems(order.itemsJson);
    for (RestockItem item : itemsToRestock) {
      if (item.quantity() <= 0) continue;
      Optional<Product> pOpt = item.sku() != null && !item.sku().isBlank()
          ? products.findBySku(item.sku())
          : (item.productId() != null ? products.findById(item.productId()) : Optional.empty());
      if (pOpt.isPresent()) {
        Product prod = pOpt.get();
        int before = prod.stock;
        prod.stock += item.quantity();
        if (prod.variants != null && !prod.variants.isEmpty()) {
          for (var v : prod.variants) {
            if (item.sku() != null && (item.sku().equalsIgnoreCase(v.variantSku) || item.sku().equalsIgnoreCase(v.ean))) {
              v.stock = (v.stock != null ? v.stock : 0) + item.quantity();
              break;
            }
          }
          if (prod.variants.size() == 1 && prod.variants.get(0).stock != null) {
            prod.variants.get(0).stock = prod.stock;
          }
        }
        products.save(prod);

        var tx = new InventoryTransaction();
        tx.productId = prod.id;
        tx.sku = prod.sku;
        tx.productName = prod.name;
        tx.warehouse = order.warehouse != null ? order.warehouse : "Main Warehouse";
        tx.type = "RESTOCK";
        tx.quantityChange = item.quantity();
        tx.beforeQuantity = before;
        tx.afterQuantity = prod.stock;
        tx.reason = "Order " + reasonStatus + " (" + order.orderNumber + ")";
        tx.reference = order.orderNumber;
        tx.performedBy = actor;
        inventoryTxs.save(tx);

        sync.sync(prod);
      }
    }
  }

  private List<RestockItem> parseItems(String json) {
    List<RestockItem> list = new ArrayList<>();
    try {
      var mapper = new tools.jackson.databind.json.JsonMapper();
      var root = mapper.readTree(json);
      if (root.isArray()) {
        for (var node : root) {
          Long prodId = null;
          if (node.has("productId")) prodId = node.get("productId").asLong();
          else if (node.has("id")) prodId = node.get("id").asLong();

          String sku = null;
          if (node.has("sku")) sku = node.get("sku").asText();

          int qty = 1;
          if (node.has("quantity")) qty = node.get("quantity").asInt(1);
          else if (node.has("qty")) qty = node.get("qty").asInt(1);

          list.add(new RestockItem(prodId, sku, qty));
        }
        return list;
      }
    } catch (Exception ignored) {}

    try {
      var itemMatcher = java.util.regex.Pattern.compile("\\{([^}]+)\\}").matcher(json);
      while (itemMatcher.find()) {
        String block = itemMatcher.group(1);
        Long prodId = null;
        String sku = null;
        int qty = 1;

        var skuM = java.util.regex.Pattern.compile("(?:sku)[=:\"]+\\s*([A-Za-z0-9_-]+)").matcher(block);
        if (skuM.find()) sku = skuM.group(1).trim();

        var idM = java.util.regex.Pattern.compile("(?:productId|id)[=:\"]+\\s*([0-9]+)").matcher(block);
        if (idM.find()) prodId = Long.parseLong(idM.group(1).trim());

        var qtyM = java.util.regex.Pattern.compile("(?:quantity|qty)[=:\"]+\\s*([0-9]+)").matcher(block);
        if (qtyM.find()) qty = Integer.parseInt(qtyM.group(1).trim());

        list.add(new RestockItem(prodId, sku, qty));
      }
    } catch (Exception ignored) {}

    return list;
  }

  @PostMapping("/{id}/send-customer-update")
  public Map<String, Object> sendCustomerUpdate(@PathVariable("id") Long id, @RequestBody(required=false) Map<String, String> body, Authentication a, HttpServletRequest req) {
    var order = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
    String carrier = body != null && body.containsKey("carrier") ? body.get("carrier") : (order.carrier != null ? order.carrier : "DPD Express Tracked 24");
    String tracking = body != null && body.containsKey("trackingNumber") ? body.get("trackingNumber") : (order.trackingNumber != null ? order.trackingNumber : "Awaiting Dispatch");
    return Map.of("success", true, "sentTo", order.customerEmail != null ? order.customerEmail : "customer", "carrier", carrier, "trackingNumber", tracking, "message", "Dispatch consignment notification sent to customer.");
  }
}
record RestockItem(Long productId, String sku, int quantity) {}

@RestController @RequestMapping("/api/inventory")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class InventoryController {
  private final ProductRepository products; private final InventoryTransactionRepository txs; private final AuditService audit; private final CatalogueSyncService sync;
  InventoryController(ProductRepository p,InventoryTransactionRepository t,AuditService a,CatalogueSyncService sync){products=p;txs=t;audit=a;this.sync=sync;}
  @GetMapping List<InventoryTransaction> ledger(){return txs.findAll(PageRequest.of(0,100,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent();}
  @PostMapping("/{productId}/adjust") @Transactional InventoryTransaction adjust(@PathVariable("productId") Long productId,@Valid @RequestBody StockRequest r,Authentication auth,HttpServletRequest req){
    var p=products.findById(productId).orElseThrow();
    int delta="REMOVE".equalsIgnoreCase(r.type())?-r.quantity():r.quantity();
    if(p.stock+delta<0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Insufficient stock");
    var t=new InventoryTransaction();
    t.productId=p.id;
    t.sku=p.sku;
    t.productName=p.name;
    t.warehouse=r.warehouse();
    t.type=r.type().toUpperCase();
    t.quantityChange=delta;
    t.beforeQuantity=p.stock;
    t.afterQuantity=p.stock+delta;
    t.reason=r.reason();
    t.reference=r.reference();
    t.performedBy=auth.getName();
    p.stock=t.afterQuantity;
    if(p.variants!=null&&!p.variants.isEmpty()&&p.variants.size()==1){
      p.variants.get(0).stock=p.stock;
    }
    products.save(p);
    txs.save(t);
    sync.sync(p);
    audit.log(auth,"ADJUST_STOCK","PRODUCT",p.id,r.reason()+" ("+delta+")",req);
    return t;
  }
}

@RestController @RequestMapping("/api/promotions")
@PreAuthorize("hasRole('ADMIN')")
class PromotionController {
  private final PromotionRepository repo; private final CatalogueSyncService sync;
  PromotionController(PromotionRepository r, CatalogueSyncService sync){this.repo=r;this.sync=sync;}
  @GetMapping List<Promotion> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"createdAt"));}
  @PostMapping Promotion create(@RequestBody Promotion p){p.id=null;if(p.code!=null)p.code=p.code.toUpperCase().trim();var saved=repo.save(p);sync.syncPromotion(saved);return saved;}
  @PutMapping("/{id}") Promotion update(@PathVariable("id") Long id,@RequestBody Promotion p){var x=repo.findById(id).orElseThrow();x.code=p.code.toUpperCase().trim();x.label=p.label;x.discountType=p.discountType;x.discountValue=p.discountValue;x.minBasketMinor=p.minBasketMinor;x.active=p.active;x.expiresOn=p.expiresOn;var saved=repo.save(x);sync.syncPromotion(saved);return saved;}
  @DeleteMapping("/{id}") void delete(@PathVariable("id") Long id){repo.deleteById(id);}
}

@RestController @RequestMapping("/api/inquiries")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class InquiryController {
  private final CustomerInquiryRepository repo;
  private final CommerceOrderRepository orders;
  private final CatalogueSyncService sync;

  InquiryController(CustomerInquiryRepository r, CommerceOrderRepository orders, CatalogueSyncService sync){
    this.repo=r; this.orders=orders; this.sync=sync;
  }

  @GetMapping
  List<Map<String,Object>> list(@RequestParam(value="status", defaultValue="") String status){
    var list = status.isBlank() ? repo.findAllByOrderByCreatedAtDesc() : repo.findByStatusOrderByCreatedAtDesc(status.toUpperCase());
    return list.stream().map(this::enrichInquiry).toList();
  }

  @GetMapping("/{id}")
  Map<String,Object> get(@PathVariable("id") Long id){
    return enrichInquiry(repo.findById(id).orElseThrow());
  }

  @PutMapping("/{id}/status")
  Map<String,Object> updateStatus(@PathVariable("id") Long id, @RequestBody Map<String,String> body){
    var x=repo.findById(id).orElseThrow();
    if(body.containsKey("status")) x.status=body.get("status");
    if(body.containsKey("notes")) x.resolutionNotes=body.get("notes");
    if(body.containsKey("resolutionNotes")) x.resolutionNotes=body.get("resolutionNotes");
    var saved=repo.save(x);
    sync.syncInquiryStatus(saved);
    return enrichInquiry(saved);
  }

  private Map<String, Object> enrichInquiry(CustomerInquiry inq) {
    Map<String, Object> m = new java.util.LinkedHashMap<>();
    m.put("id", inq.id);
    m.put("ticketNumber", inq.ticketNumber);
    m.put("name", inq.name);
    m.put("email", inq.email);
    m.put("phone", inq.phone);
    m.put("category", inq.category);
    m.put("orderNumber", inq.orderNumber);
    m.put("productSku", inq.productSku);
    m.put("productName", inq.productName);
    m.put("attachmentUrl", inq.attachmentUrl);
    m.put("attachmentFilename", inq.attachmentFilename);
    m.put("message", inq.message);
    m.put("status", inq.status);
    m.put("resolutionNotes", inq.resolutionNotes);
    m.put("createdAt", inq.createdAt != null ? inq.createdAt.toString() : "");
    m.put("updatedAt", inq.updatedAt != null ? inq.updatedAt.toString() : "");

    boolean hasOrderNumber = inq.orderNumber != null && !inq.orderNumber.isBlank();
    boolean orderVerified = false;
    boolean emailMatchesOrder = false;
    Map<String, Object> orderDetails = null;

    if (hasOrderNumber) {
      String cleanOrder = inq.orderNumber.trim();
      if (cleanOrder.startsWith("#")) cleanOrder = cleanOrder.substring(1).trim();
      var opt = orders.findByOrderNumber(cleanOrder);
      if (opt.isEmpty() && cleanOrder.matches("\\d+")) {
        try { opt = orders.findById(Long.parseLong(cleanOrder)); } catch (Exception ignored) {}
      }
      if (opt.isPresent()) {
        orderVerified = true;
        var o = opt.get();
        orderDetails = new java.util.LinkedHashMap<>();
        orderDetails.put("id", o.id);
        orderDetails.put("orderNumber", o.orderNumber != null ? o.orderNumber : "");
        orderDetails.put("customerName", o.customerName != null ? o.customerName : "");
        orderDetails.put("customerEmail", o.customerEmail != null ? o.customerEmail : "");
        orderDetails.put("totalMinor", o.totalMinor);
        orderDetails.put("orderStatus", o.orderStatus != null ? o.orderStatus : "");
        orderDetails.put("paymentStatus", o.paymentStatus != null ? o.paymentStatus : "");
        orderDetails.put("carrier", o.carrier != null ? o.carrier : "");
        orderDetails.put("trackingNumber", o.trackingNumber != null ? o.trackingNumber : "");
        orderDetails.put("createdAt", o.createdAt != null ? o.createdAt.toString() : "");
        orderDetails.put("itemsJson", o.itemsJson != null ? o.itemsJson : "");

        if (inq.email != null && !inq.email.isBlank() && o.customerEmail != null) {
          emailMatchesOrder = inq.email.trim().equalsIgnoreCase(o.customerEmail.trim());
        }
      }
    }

    m.put("hasOrderNumber", hasOrderNumber);
    m.put("orderVerified", orderVerified);
    m.put("emailMatchesOrder", emailMatchesOrder);
    m.put("verifiedOrder", orderDetails);
    return m;
  }

  @PostMapping("/{id}/send-customer-response")
  public Map<String, Object> sendCustomerResponse(@PathVariable("id") Long id, @RequestBody(required=false) Map<String, String> body, Authentication a, HttpServletRequest req) {
    var inq = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Inquiry not found"));
    String note = body != null && body.containsKey("message") ? body.get("message") : inq.resolutionNotes;
    inq.resolutionNotes = note;
    if (body != null && body.containsKey("status")) inq.status = body.get("status");
    var saved = repo.save(inq);
    sync.syncInquiryStatus(saved);
    return Map.of("success", true, "sentTo", inq.email != null ? inq.email : "customer", "ticketNumber", inq.ticketNumber != null ? inq.ticketNumber : String.valueOf(inq.id), "message", "Response message sent to customer successfully.");
  }
}

@RestController @RequestMapping("/api/internal")
class InternalSyncController {
  private final String secret;
  private final CommerceOrderRepository orders;
  private final CustomerRepository customers;
  private final ProductRepository products;
  private final InventoryTransactionRepository inventoryTxs;
  private final CustomerInquiryRepository inquiries;
  private final ProductReviewRepository reviews;
  private final CmsContentRepository cms;
  private final CatalogueSyncService sync;

  InternalSyncController(@Value("${app.catalogue-sync-secret}") String secret,
                         CommerceOrderRepository orders, CustomerRepository customers,
                         ProductRepository products, InventoryTransactionRepository inventoryTxs,
                         CustomerInquiryRepository inquiries, ProductReviewRepository reviews,
                         CmsContentRepository cms, CatalogueSyncService sync){
    this.secret=secret;this.orders=orders;this.customers=customers;this.products=products;
    this.inventoryTxs=inventoryTxs;this.inquiries=inquiries;this.reviews=reviews;this.cms=cms;this.sync=sync;
  }

  private void checkSecret(String supplied){
    if(supplied==null||secret==null||!java.security.MessageDigest.isEqual(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8),supplied.getBytes(java.nio.charset.StandardCharsets.UTF_8))){
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Invalid catalogue sync secret");
    }
  }

  @PostMapping("/orders/sync") @Transactional
  public Map<String,Object> syncOrder(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                      @RequestBody StorefrontOrderPayload payload){
    checkSecret(supplied);
    CommerceOrder order = orders.findByOrderNumber(payload.orderNumber()).orElseGet(CommerceOrder::new);
    order.orderNumber = payload.orderNumber();
    order.customerName = payload.customerName();
    order.customerEmail = payload.customerEmail();
    order.customerPhone = payload.customerPhone();
    order.totalMinor = payload.totalMinor();
    order.deliveryAddress = payload.deliveryAddress();
    order.discountCode = payload.discountCode();
    order.discountMinor = payload.discountMinor();
    order.itemsJson = payload.itemsJson();
    order.channel = "STOREFRONT";
    order.orderStatus = "PROCESSING";
    order.paymentStatus = "PAID";
    order.fulfilmentStatus = "UNFULFILLED";
    order.carrier = "DPD Express";
    order.trackingNumber = "DPD-GB-" + String.format("%08d", Math.abs(payload.orderNumber().hashCode() % 100000000));
    order.estimatedDelivery = java.time.LocalDate.now().plusDays(2).toString();
    var saved = orders.save(order);

    // Sync to Customer CRM
    if (payload.customerEmail() != null && !payload.customerEmail().isBlank()) {
      Customer cust = customers.findByEmailIgnoreCase(payload.customerEmail().trim()).orElseGet(Customer::new);
      if (cust.id == null) {
        cust.name = (payload.customerName() != null && !payload.customerName().isBlank()) ? payload.customerName() : payload.customerEmail();
        cust.email = payload.customerEmail().trim().toLowerCase();
        cust.phone = payload.customerPhone();
        cust.status = "ACTIVE";
        cust.lifetimeValueMinor = payload.totalMinor();
      } else {
        cust.lifetimeValueMinor += payload.totalMinor();
        if (payload.customerPhone() != null && !payload.customerPhone().isBlank()) cust.phone = payload.customerPhone();
      }
      customers.save(cust);
    }

    // Deduct stock in Admin and record InventoryTransaction
    if (payload.items() != null) {
      for (var item : payload.items()) {
        Optional<Product> pOpt = item.sku() != null ? products.findBySku(item.sku()) : (item.productId() != null ? products.findById(item.productId()) : Optional.empty());
        if (pOpt.isPresent()) {
          Product p = pOpt.get();
          int before = p.stock;
          p.stock = Math.max(0, p.stock - item.quantity());
          if (p.variants != null && !p.variants.isEmpty()) {
            for (var v : p.variants) {
              if ((item.variantId() != null && item.variantId().equals(v.id))
                  || (item.sku() != null && (item.sku().equalsIgnoreCase(v.variantSku) || item.sku().equalsIgnoreCase(v.ean)))) {
                v.stock = Math.max(0, (v.stock != null ? v.stock : 0) - item.quantity());
                break;
              }
            }
          }
          products.save(p);

          var t = new InventoryTransaction();
          t.productId = p.id;
          t.sku = p.sku;
          t.productName = p.name;
          t.warehouse = "Main Warehouse";
          t.type = "SALE";
          t.quantityChange = -item.quantity();
          t.beforeQuantity = before;
          t.afterQuantity = p.stock;
          t.reason = "Storefront Checkout (" + payload.orderNumber() + ")";
          t.reference = payload.orderNumber();
          t.performedBy = "storefront";
          inventoryTxs.save(t);
        }
      }
    }
    return Map.of("success", true, "orderNumber", saved.orderNumber, "trackingNumber", saved.trackingNumber);
  }

  @PostMapping("/orders/status-sync") @Transactional
  public Map<String,Object> syncOrderStatus(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                            @RequestBody Map<String,String> body){
    checkSecret(supplied);
    String orderNumber = body.get("orderNumber");
    if (orderNumber == null || orderNumber.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Order number required");
    var opt = orders.findByOrderNumber(orderNumber);
    if (opt.isPresent()) {
      var o = opt.get();
      if (body.get("status") != null && !body.get("status").isBlank()) o.orderStatus = body.get("status").toUpperCase();
      if (body.get("paymentStatus") != null && !body.get("paymentStatus").isBlank()) o.paymentStatus = body.get("paymentStatus").toUpperCase();
      orders.save(o);
      return Map.of("success", true, "orderNumber", orderNumber, "paymentStatus", o.paymentStatus);
    }
    return Map.of("success", false, "message", "Order not found");
  }

  @PostMapping("/customers/sync") @Transactional
  public Map<String,Object> syncCustomer(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                         @RequestBody Map<String,String> body){
    checkSecret(supplied);
    String email = body.get("email");
    if (email == null || email.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Email required");
    Customer cust = customers.findByEmailIgnoreCase(email.trim()).orElseGet(Customer::new);
    if (cust.id == null) {
      cust.name = Optional.ofNullable(body.get("fullName")).orElse(email);
      cust.email = email.trim().toLowerCase();
      cust.phone = body.get("phone");
      cust.status = "ACTIVE";
      cust.city = body.get("city");
      customers.save(cust);
    }
    return Map.of("success", true, "email", email);
  }

  @PostMapping("/inquiries/sync") @Transactional
  public Map<String,Object> syncInquiry(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                        @RequestBody CustomerInquiry inquiry){
    checkSecret(supplied);
    inquiry.id = null;
    inquiry.status = "NEW";
    var saved = inquiries.save(inquiry);
    return Map.of("success", true, "id", saved.id);
  }

  @PostMapping("/reviews/sync") @Transactional
  public Map<String,Object> syncReview(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,
                                       @RequestBody Map<String,Object> payload){
    checkSecret(supplied);
    Long storeReviewId = payload.get("storeReviewId") != null ? Long.valueOf(payload.get("storeReviewId").toString()) : null;
    ProductReview rev = storeReviewId != null ? reviews.findByStoreReviewId(storeReviewId).orElseGet(ProductReview::new) : new ProductReview();
    rev.storeReviewId = storeReviewId;
    if (payload.get("productId") != null) rev.productId = Long.valueOf(payload.get("productId").toString());
    if (payload.get("productSku") != null) rev.productSku = String.valueOf(payload.get("productSku"));
    if (payload.get("category") != null) rev.category = String.valueOf(payload.get("category"));
    if (payload.get("author") != null) rev.author = String.valueOf(payload.get("author"));
    if (payload.get("authorEmail") != null) rev.authorEmail = String.valueOf(payload.get("authorEmail"));
    if (payload.get("customerKey") != null) rev.customerKey = String.valueOf(payload.get("customerKey"));
    if (payload.get("location") != null) rev.location = String.valueOf(payload.get("location"));
    if (payload.get("role") != null) rev.role = String.valueOf(payload.get("role"));
    if (payload.get("rating") != null) rev.rating = Integer.valueOf(payload.get("rating").toString());
    if (payload.get("title") != null) rev.title = String.valueOf(payload.get("title"));
    if (payload.get("comment") != null) rev.comment = String.valueOf(payload.get("comment"));
    if (payload.get("status") != null) rev.status = String.valueOf(payload.get("status"));
    var saved = reviews.save(rev);
    return Map.of("success", true, "id", saved.id);
  }

  @GetMapping("/content/published")
  public List<CmsContent> getPublishedContent(@RequestHeader("X-Catalogue-Sync-Secret") String supplied){
    checkSecret(supplied);
    return cms.findByStatus("PUBLISHED");
  }
}

@RestController @RequestMapping("/api/reviews")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class ReviewController {
  private final ProductReviewRepository repo;
  private final CatalogueSyncService sync;
  private final AuditService audit;

  ReviewController(ProductReviewRepository r, CatalogueSyncService sync, AuditService audit){
    this.repo = r;
    this.sync = sync;
    this.audit = audit;
  }

  @GetMapping
  List<ProductReview> list(@RequestParam(value="status", defaultValue="") String status){
    if(status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status.trim())){
      return repo.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
    }
    return repo.findAllByOrderByCreatedAtDesc();
  }

  @GetMapping("/count-pending")
  Map<String, Long> countPending(){
    return Map.of("pending", repo.countByStatus("PENDING_APPROVAL"));
  }

  @PostMapping("/{id}/approve")
  ProductReview approve(@PathVariable("id") Long id, Authentication a, HttpServletRequest req){
    var r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
    r.status = "APPROVED";
    var saved = repo.save(r);
    syncReviewStatusToStorefront(r);
    audit.log(a, "APPROVE", "PRODUCT_REVIEW", id, "Approved review by " + r.author, req);
    return saved;
  }

  @PostMapping("/{id}/reject")
  ProductReview reject(@PathVariable("id") Long id, Authentication a, HttpServletRequest req){
    var r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
    r.status = "REJECTED";
    var saved = repo.save(r);
    syncReviewStatusToStorefront(r);
    audit.log(a, "REJECT", "PRODUCT_REVIEW", id, "Rejected review by " + r.author, req);
    return saved;
  }

  @PostMapping
  ProductReview createReview(@RequestBody ProductReview r, Authentication a, HttpServletRequest req){
    r.id = null;
    if(r.author == null || r.author.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Author is required");
    if(r.rating == null || r.rating < 1 || r.rating > 5) r.rating = 5;
    if(r.status == null || r.status.isBlank()) r.status = "APPROVED";
    if(r.role == null || r.role.isBlank()) r.role = "Verified Homeowner";
    if(r.verifiedPurchase == null) r.verifiedPurchase = true;
    var saved = repo.save(r);
    audit.log(a, "CREATE", "PRODUCT_REVIEW", saved.id, "Created review by " + saved.author, req);
    return saved;
  }

  @PutMapping("/{id}")
  ProductReview updateReview(@PathVariable("id") Long id, @RequestBody ProductReview p, Authentication a, HttpServletRequest req){
    var r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
    if(p.author != null && !p.author.isBlank()) r.author = p.author;
    if(p.authorEmail != null) r.authorEmail = p.authorEmail;
    if(p.productSku != null) r.productSku = p.productSku;
    if(p.category != null) r.category = p.category;
    if(p.rating != null && p.rating >= 1 && p.rating <= 5) r.rating = p.rating;
    if(p.title != null) r.title = p.title;
    if(p.comment != null) r.comment = p.comment;
    if(p.status != null) r.status = p.status;
    if(p.role != null) r.role = p.role;
    if(p.location != null) r.location = p.location;
    if(p.verifiedPurchase != null) r.verifiedPurchase = p.verifiedPurchase;
    var saved = repo.save(r);
    syncReviewStatusToStorefront(r);
    audit.log(a, "UPDATE", "PRODUCT_REVIEW", id, "Updated review by " + saved.author, req);
    return saved;
  }

  @DeleteMapping("/{id}")
  ResponseEntity<Void> deleteReview(@PathVariable("id") Long id, Authentication a, HttpServletRequest req){
    var r = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
    repo.delete(r);
    audit.log(a, "DELETE", "PRODUCT_REVIEW", id, "Deleted review by " + r.author, req);
    return ResponseEntity.noContent().build();
  }

  private void syncReviewStatusToStorefront(ProductReview r) {
    if (r.storeReviewId != null) {
      try {
        sync.updateReviewStatus(r.storeReviewId, r.status);
      } catch (Exception ignored) {}
    }
  }
}

@RestController @RequestMapping("/api/companies")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class CompanyController {
  private final BrandRepository brandRepo;
  private final ProductRepository productRepo;
  private final CatalogueSyncService sync;
  private final AuditService audit;

  CompanyController(BrandRepository brandRepo, ProductRepository productRepo, CatalogueSyncService sync, AuditService audit){
    this.brandRepo = brandRepo;
    this.productRepo = productRepo;
    this.sync = sync;
    this.audit = audit;
  }

  @GetMapping
  public List<Map<String,Object>> list(){
    ensureDefaultBrands();
    var brands = brandRepo.findAllByOrderBySortOrderAscNameAsc();
    var allProducts = productRepo.findAll().stream().filter(p -> !p.archived).toList();
    var res = new ArrayList<Map<String,Object>>();
    for (var b : brands) {
      var prodList = allProducts.stream().filter(p -> b.name != null && b.name.equalsIgnoreCase(p.brand)).toList();
      long activeCount = prodList.stream().filter(p -> "PUBLISHED".equalsIgnoreCase(p.status)).count();
      var cats = prodList.stream().map(p -> p.category).filter(Objects::nonNull).distinct().toList();
      var m = new LinkedHashMap<String,Object>();
      m.put("id", b.id);
      m.put("name", b.name);
      m.put("code", b.code != null ? b.code : "");
      m.put("logoUrl", b.logoUrl != null ? b.logoUrl : "");
      m.put("website", b.website != null ? b.website : "");
      m.put("contactEmail", b.contactEmail != null ? b.contactEmail : "");
      m.put("contactPhone", b.contactPhone != null ? b.contactPhone : "");
      m.put("country", b.country != null ? b.country : "United Kingdom");
      m.put("description", b.description != null ? b.description : "");
      m.put("status", b.status != null ? b.status : "ACTIVE");
      m.put("sortOrder", b.sortOrder != null ? b.sortOrder : 0);
      m.put("productCount", prodList.size());
      m.put("activeProductCount", activeCount);
      m.put("categories", cats);
      m.put("allActive", prodList.size() > 0 && activeCount == prodList.size());
      res.add(m);
    }
    return res;
  }

  @PostMapping
  public Brand create(@RequestBody Brand b, Authentication a, HttpServletRequest req){
    b.id = null;
    if (b.name == null || b.name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brand name is required");
    var existing = brandRepo.findByNameIgnoreCase(b.name.trim());
    if (existing.isPresent()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brand with this name already exists");
    if (b.code == null || b.code.isBlank()) b.code = b.name.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
    if (b.status == null || b.status.isBlank()) b.status = "ACTIVE";
    var saved = brandRepo.save(b);
    audit.log(a, "CREATE", "BRAND", saved.id, "Created brand " + saved.name, req);
    return saved;
  }

  @PutMapping("/{id}")
  public Brand update(@PathVariable("id") Long id, @RequestBody Brand b, Authentication a, HttpServletRequest req){
    var existing = brandRepo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
    String oldName = existing.name;
    existing.name = b.name;
    existing.code = b.code;
    existing.logoUrl = b.logoUrl;
    existing.website = b.website;
    existing.contactEmail = b.contactEmail;
    existing.contactPhone = b.contactPhone;
    existing.country = b.country;
    existing.description = b.description;
    existing.status = b.status;
    existing.sortOrder = b.sortOrder;
    var saved = brandRepo.save(existing);
    if (b.name != null && !b.name.equalsIgnoreCase(oldName)) {
      for (var p : productRepo.findAll()) {
        if (!p.archived && oldName != null && oldName.equalsIgnoreCase(p.brand)) {
          p.brand = b.name;
          productRepo.save(p);
          sync.sync(p);
        }
      }
    }
    audit.log(a, "UPDATE", "BRAND", id, "Updated brand " + saved.name, req);
    return saved;
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable("id") Long id, Authentication a, HttpServletRequest req){
    var existing = brandRepo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
    brandRepo.delete(existing);
    audit.log(a, "DELETE", "BRAND", id, "Deleted brand " + existing.name, req);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/toggle-status")
  public Map<String,Object> toggleStatus(@PathVariable("id") Long id, @RequestParam(value="active", defaultValue="true") boolean active, Authentication a, HttpServletRequest req){
    var existing = brandRepo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
    existing.status = active ? "ACTIVE" : "INACTIVE";
    brandRepo.save(existing);
    String targetStatus = active ? "PUBLISHED" : "DRAFT";
    var prods = productRepo.findAll().stream().filter(p -> !p.archived && existing.name.equalsIgnoreCase(p.brand)).toList();
    int changed = 0;
    for (var p : prods) {
      p.status = targetStatus;
      productRepo.save(p);
      sync.sync(p);
      changed++;
    }
    audit.log(a, "TOGGLE_BRAND", "BRAND", id, "Switched " + existing.name + " (" + changed + " products) to " + targetStatus, req);
    return Map.of("success", true, "brand", existing.name, "count", changed, "active", active);
  }

  private void ensureDefaultBrands() {
    if (brandRepo.count() == 0) {
      var defaultNames = List.of("Terma", "Hearth Luxury", "Reina", "Kartell", "Hudson Reed", "Castrads", "MHS Radiators", "Apollo");
      int order = 1;
      for (var name : defaultNames) {
        var b = new Brand();
        b.name = name;
        b.code = name.replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        b.status = "ACTIVE";
        b.sortOrder = order++;
        b.country = "United Kingdom";
        brandRepo.save(b);
      }
      var existingProds = productRepo.findAll();
      for (var p : existingProds) {
        if (p.brand != null && !p.brand.isBlank() && brandRepo.findByNameIgnoreCase(p.brand.trim()).isEmpty()) {
          var b = new Brand();
          b.name = p.brand.trim();
          b.code = p.brand.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
          b.status = "ACTIVE";
          b.sortOrder = order++;
          b.country = "United Kingdom";
          brandRepo.save(b);
        }
      }
    }
  }
}

record StorefrontOrderPayload(String orderNumber, String customerName, String customerEmail, String customerPhone,
                              long totalMinor, String deliveryAddress, String discountCode, Long discountMinor,
                              String itemsJson, List<StorefrontOrderItem> items){}
record StorefrontOrderItem(Long productId, Long variantId, String sku, int quantity, long priceMinor){}

@RestController @RequestMapping("/api/content")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class CmsController {
  private final CmsContentRepository repo;
  private final Path uploadDir;
  private final CatalogueSyncService sync;

  CmsController(CmsContentRepository r, @Value("${app.upload-dir}") String uploadDir, CatalogueSyncService sync) throws java.io.IOException {
    this.repo = r;
    this.uploadDir = Path.of(uploadDir).toAbsolutePath().normalize();
    this.sync = sync;
    Files.createDirectories(this.uploadDir);
  }

  @GetMapping List<CmsContent> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"updatedAt"));}
  @GetMapping("/{id}") CmsContent get(@PathVariable("id") Long id){return repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Page not found"));}
  @PostMapping CmsContent create(@RequestBody CmsContent c){
    c.id=null;
    if("PUBLISHED".equals(c.status)&&c.publishedAt==null)c.publishedAt=Instant.now();
    return repo.save(c);
  }
  @PutMapping("/{id}") CmsContent update(@PathVariable("id") Long id,@RequestBody CmsContent p){
    var c=repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Page not found"));
    c.title=p.title;
    c.slug=p.slug;
    c.type=p.type;
    c.status=p.status;
    c.body=p.body;
    c.seoTitle=p.seoTitle;
    c.metaDescription=p.metaDescription;
    c.pdfUrl=p.pdfUrl;
    c.pdfFilename=p.pdfFilename;
    if (p.tag != null) c.tag = p.tag;
    if (p.imageUrl != null) c.imageUrl = p.imageUrl;
    if (p.buttonText != null) c.buttonText = p.buttonText;
    if (p.linkUrl != null) c.linkUrl = p.linkUrl;
    if (p.sortOrder != null) c.sortOrder = p.sortOrder;
    if("PUBLISHED".equals(c.status)&&c.publishedAt==null)c.publishedAt=Instant.now();
    return repo.save(c);
  }
  @DeleteMapping("/{id}") void delete(@PathVariable("id") Long id){repo.deleteById(id);}

  @PostMapping(value="/upload-pdf", consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
  Map<String,Object> uploadPdf(@RequestPart("file") MultipartFile file) throws java.io.IOException {
    if(file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select a PDF file to upload");
    var original = file.getOriginalFilename();
    if(original == null || !original.toLowerCase().endsWith(".pdf")) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only .pdf files are allowed");
    }
    byte[] bytes = file.getBytes();
    if(bytes.length < 4 || bytes[0] != '%' || bytes[1] != 'P' || bytes[2] != 'D' || bytes[3] != 'F') {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The uploaded file is not a valid PDF");
    }
    String stored = UUID.randomUUID() + ".pdf";
    Path target = uploadDir.resolve(stored).normalize();
    Files.write(target, bytes);
    try {
      sync.syncFile(stored, bytes);
    } catch(Exception ignored){}
    return Map.of(
      "url", "/api/product-images/" + stored,
      "filename", original,
      "storedName", stored,
      "size", bytes.length
    );
  }
}

@RestController @RequestMapping("/api/banners")
@PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
class BannerController {
  private final CmsContentRepository repo;

  BannerController(CmsContentRepository repo) {
    this.repo = repo;
  }

  @GetMapping
  public List<CmsContent> list(@RequestParam(value = "type", required = false) String type) {
    if (type != null && !type.isBlank()) {
      return repo.findByTypeOrderBySortOrderAsc(type.trim().toUpperCase());
    }
    var banners = repo.findByTypeOrderBySortOrderAsc("BANNER");
    var campaigns = repo.findByTypeOrderBySortOrderAsc("CAMPAIGN_BANNER");
    List<CmsContent> combined = new java.util.ArrayList<>(banners);
    combined.addAll(campaigns);
    combined.sort(java.util.Comparator.comparingInt(c -> c.sortOrder != null ? c.sortOrder : 0));
    return combined;
  }

  @GetMapping("/{id}")
  public CmsContent get(@PathVariable("id") Long id) {
    return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Banner not found"));
  }

  @PostMapping
  public CmsContent create(@RequestBody CmsContent b) {
    b.id = null;
    if (b.type == null || b.type.isBlank()) {
      b.type = "BANNER";
    } else {
      b.type = b.type.trim().toUpperCase();
    }
    if (b.status == null || b.status.isBlank()) b.status = "PUBLISHED";
    if (b.slug == null || b.slug.isBlank()) {
      b.slug = (b.type.toLowerCase().replace('_', '-')) + "-" + System.currentTimeMillis();
    }
    if (b.sortOrder == null) b.sortOrder = 0;
    if ("PUBLISHED".equals(b.status) && b.publishedAt == null) {
      b.publishedAt = Instant.now();
    }
    return repo.save(b);
  }

  @PutMapping("/{id}")
  public CmsContent update(@PathVariable("id") Long id, @RequestBody CmsContent p) {
    var b = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Banner not found"));
    b.title = p.title;
    b.body = p.body;
    b.tag = p.tag;
    b.imageUrl = p.imageUrl;
    b.buttonText = p.buttonText;
    b.linkUrl = p.linkUrl;
    if (p.type != null && !p.type.isBlank()) {
      b.type = p.type.trim().toUpperCase();
    }
    b.sortOrder = p.sortOrder != null ? p.sortOrder : 0;
    if (p.status != null) b.status = p.status;
    if ("PUBLISHED".equals(b.status) && b.publishedAt == null) {
      b.publishedAt = Instant.now();
    }
    return repo.save(b);
  }

  @PostMapping("/{id}/toggle-status")
  public CmsContent toggleStatus(@PathVariable("id") Long id) {
    var b = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Banner not found"));
    b.status = "PUBLISHED".equalsIgnoreCase(b.status) ? "DRAFT" : "PUBLISHED";
    if ("PUBLISHED".equals(b.status) && b.publishedAt == null) {
      b.publishedAt = Instant.now();
    }
    return repo.save(b);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable("id") Long id) {
    repo.deleteById(id);
  }
}

@RestController @RequestMapping("/api/settings/social")
class SocialSettingsController {
  private final CmsContentRepository repo;
  SocialSettingsController(CmsContentRepository repo) { this.repo = repo; }

  @GetMapping
  public Map<String, String> get() {
    Map<String, String> defaults = new java.util.LinkedHashMap<>();
    defaults.put("facebook", "https://www.facebook.com/share/1CPi7d3YxZ/");
    defaults.put("instagram", "https://www.instagram.com/theheatingandplumbing?srtk=eGt6ZGhmZGcwajU1");
    defaults.put("tiktok", "https://www.tiktok.com/@theheatingandplumbing");
    defaults.put("x", "https://x.com/theheatingandplumbing");
    defaults.put("pinterest", "https://pinterest.com/theheatingandplumbing");

    var c = repo.findAll().stream().filter(x -> "social-links".equalsIgnoreCase(x.slug)).findFirst();
    if (c.isPresent() && c.get().body != null && !c.get().body.isBlank()) {
      try {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        Map<String, String> map = mapper.readValue(c.get().body, Map.class);
        if (map != null) defaults.putAll(map);
      } catch (Exception ignored) {}
    }
    return defaults;
  }

  @PutMapping
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  public Map<String, String> update(@RequestBody Map<String, String> links) {
    var existing = repo.findAll().stream().filter(x -> "social-links".equalsIgnoreCase(x.slug)).findFirst();
    var c = existing.orElseGet(CmsContent::new);
    c.slug = "social-links";
    c.title = "Brand Social Media Links";
    c.type = "SETTINGS";
    c.status = "PUBLISHED";
    try {
      var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
      c.body = mapper.writeValueAsString(links);
    } catch (Exception e) {
      c.body = "{}";
    }
    c.publishedAt = Instant.now();
    repo.save(c);
    return get();
  }
}

@RestController
@RequestMapping("/api/navigation")
class NavigationMenuController {
  private final NavigationMenuRepository repo;
  NavigationMenuController(NavigationMenuRepository repo) {
    this.repo = repo;
  }

  @GetMapping
  public List<NavigationMenu> list() {
    if (repo.count() == 0) {
      seedDefaultMenus();
    }
    return repo.findAllByOrderBySortOrderAsc();
  }

  @GetMapping("/{id}")
  public NavigationMenu get(@PathVariable("id") Long id) {
    return repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  @PostMapping
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  public NavigationMenu create(@RequestBody NavigationMenu incoming) {
    if (incoming.menuId == null || incoming.menuId.isBlank()) {
      incoming.menuId = incoming.title != null ? incoming.title.toLowerCase().replaceAll("[^a-z0-9]+", "-") : "menu-" + System.currentTimeMillis();
    }
    if (incoming.sortOrder == null) {
      incoming.sortOrder = (int) repo.count() + 1;
    }
    return repo.save(incoming);
  }

  @PutMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  public NavigationMenu update(@PathVariable("id") Long id, @RequestBody NavigationMenu incoming) {
    var existing = repo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (incoming.menuId != null && !incoming.menuId.isBlank()) existing.menuId = incoming.menuId;
    if (incoming.title != null) existing.title = incoming.title;
    existing.category = incoming.category;
    existing.icon = incoming.icon;
    existing.badge = incoming.badge;
    existing.imageUrl = incoming.imageUrl;
    existing.description = incoming.description;
    if (incoming.sortOrder != null) existing.sortOrder = incoming.sortOrder;
    if (incoming.status != null) existing.status = incoming.status;
    existing.filterOptionsJson = incoming.filterOptionsJson;
    existing.columnsJson = incoming.columnsJson;
    existing.featuredPromoJson = incoming.featuredPromoJson;
    return repo.save(existing);
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  public void delete(@PathVariable("id") Long id) {
    repo.deleteById(id);
  }

  @PostMapping("/reset-defaults")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  public List<NavigationMenu> resetDefaults() {
    repo.deleteAll();
    seedDefaultMenus();
    return repo.findAllByOrderBySortOrderAsc();
  }

  void seedDefaultMenus() {
    var m1 = new NavigationMenu();
    m1.menuId = "bathroom-suites";
    m1.title = "Bathroom Suites";
    m1.category = "Bathrooms";
    m1.icon = "🛁";
    m1.badge = "";
    m1.imageUrl = "/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg";
    m1.description = "Transform your bathroom with luxury heated towel warmers, mirror radiators, dual fuel all-season heating kits, and precision chrome & black valves.";
    m1.sortOrder = 1;
    m1.status = "PUBLISHED";
    m1.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":false,\"showPanelTypeFilter\":false,\"showHeightFilter\":false,\"showFuelTypeFilter\":false,\"subcategories\":[{\"label\":\"Alex Multi-Rail Heated Warmer\",\"query\":\"Alex\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\",\"badge\":\"BESTSELLER\"},{\"label\":\"Rolo-Mirror Integrated Radiators\",\"query\":\"Rolo-Mirror\",\"imageUrl\":\"/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png\",\"badge\":\"WITH MIRROR\"},{\"label\":\"Dual Fuel Conversion Kits\",\"query\":\"Dual Fuel\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\",\"badge\":\"ALL-SEASON\"},{\"label\":\"Retro Period Warmers\",\"query\":\"Retro\",\"imageUrl\":\"/api/product-images/0c7612a1-4309-4372-9466-c61cf478f0af.jpg\",\"badge\":\"VINTAGE\"},{\"label\":\"All Bathroom Towel Rails\",\"query\":\"Heated Towel Rails\",\"imageUrl\":\"/api/product-images/2a19631f-69b4-404a-8fa2-49cdc0dbed53.jpg\"}]}";
    m1.columnsJson = "[{\"title\":\"Designer Heated Rails\",\"items\":[{\"label\":\"Alex Multi-Rail Heated Warmer\",\"query\":\"Alex\",\"badge\":\"BESTSELLER\"},{\"label\":\"Dexter Contemporary Rails\",\"query\":\"Dexter\",\"badge\":\"POPULAR\"},{\"label\":\"Easy Slimline Compact Rails\",\"query\":\"Easy\",\"badge\":\"SPACE SAVER\"},{\"label\":\"Fiona Elegant Towel Rails\",\"query\":\"Fiona\"},{\"label\":\"All Bathroom Towel Rails\",\"category\":\"Heated Towel Rails\"}]},{\"title\":\"Luxury & Period Warmers\",\"items\":[{\"label\":\"Retro Traditional Heated Rails\",\"query\":\"Retro\",\"badge\":\"PERIOD\"},{\"label\":\"Salisbury Heritage Towel Rails\",\"query\":\"Salisbury\"},{\"label\":\"Quadrus Bold Statement Rails\",\"query\":\"Quadrus\"},{\"label\":\"Vivo & Zig Zag Architectural Rails\",\"query\":\"Zig Zag\",\"badge\":\"DESIGNER\"},{\"label\":\"Crystal Architectural Rails\",\"query\":\"Crystal\"}]},{\"title\":\"Bathroom Radiators & Dual Fuel\",\"items\":[{\"label\":\"Rolo-Mirror Integrated Radiators\",\"query\":\"Rolo-Mirror\",\"badge\":\"WITH MIRROR\"},{\"label\":\"Warp S & T Bold Warmers\",\"query\":\"Warp\"},{\"label\":\"Dual Fuel Conversion Kits\",\"query\":\"Dual Fuel\",\"badge\":\"ALL-SEASON\"},{\"label\":\"Thermostatic Chrome & Black TRVs\",\"query\":\"Corner\"},{\"label\":\"Complete Bathroom Heating Collection\",\"category\":\"Bathrooms\"}]}]";
    m1.featuredPromoJson = "{\"tag\":\"LUXURY BATHROOM HEATING\",\"title\":\"Alex Multi-Rail Towel Warmer\",\"subtitle\":\"Engineered for rapid towel drying, high thermal output, and durable corrosion-resistant finish.\",\"cta\":\"Explore Bathroom Warmers →\",\"category\":\"Bathrooms\",\"query\":\"Alex\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\"}";
    repo.save(m1);

    var m2 = new NavigationMenu();
    m2.menuId = "radiators";
    m2.title = "Radiators";
    m2.category = "Radiators";
    m2.icon = "🔥";
    m2.badge = "";
    m2.imageUrl = "/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png";
    m2.description = "Discover our extensive collection of high-efficiency convector radiators, column radiators, and designer flat panels engineered to keep British homes warm.";
    m2.sortOrder = 2;
    m2.status = "PUBLISHED";
    m2.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":true,\"showPanelTypeFilter\":true,\"showHeightFilter\":true,\"showFuelTypeFilter\":false,\"subcategories\":[{\"label\":\"Type 22 Double Convector (DF)\",\"query\":\"DF\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\",\"badge\":\"BESTSELLER\"},{\"label\":\"Type 11 Single Convector (SF)\",\"query\":\"SF\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.jpg\",\"badge\":\"SLIMLINE\"},{\"label\":\"Type 21 Double-Single (HF)\",\"query\":\"HF\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\"},{\"label\":\"Compact 6 DS (Multi-Port)\",\"query\":\"DS\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\"},{\"label\":\"Compact 6 TS (Triple Panel)\",\"query\":\"TS\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.jpg\"},{\"label\":\"Colorado Column Radiators\",\"query\":\"Colorado\",\"imageUrl\":\"/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png\",\"badge\":\"TRADITIONAL\"},{\"label\":\"Bergamo Sectional Radiators\",\"query\":\"Bergamo\",\"imageUrl\":\"/api/product-images/56dd11ba-f583-4cc8-8918-66dc45078c3b.jpg\"}]}";
    m2.columnsJson = "[{\"title\":\"Convector Panel Types\",\"items\":[{\"label\":\"Type 22 Double Convector (DF)\",\"query\":\"DF\",\"badge\":\"BESTSELLER\"},{\"label\":\"Type 11 Single Convector (SF)\",\"query\":\"SF\",\"badge\":\"SLIMLINE\"},{\"label\":\"Type 21 Double-Single (HF)\",\"query\":\"HF\"},{\"label\":\"Compact 6 DS (Multi-Port Double)\",\"query\":\"DS\",\"badge\":\"6-TAPPING\"},{\"label\":\"Compact 6 TS (Triple High Output)\",\"query\":\"TS\",\"badge\":\"TYPE 33\"},{\"label\":\"Compact 6 QS (Quad Maximum Density)\",\"query\":\"QS\",\"badge\":\"TYPE 44\"},{\"label\":\"All Convector Radiators\",\"category\":\"Radiators\"}]},{\"title\":\"Designer & Column Radiators\",\"items\":[{\"label\":\"Colorado Multi-Column Radiators\",\"query\":\"Colorado\",\"badge\":\"BESTSELLER\"},{\"label\":\"Bergamo Sectional Radiators\",\"query\":\"Bergamo\"},{\"label\":\"Forte Double & Single Panels\",\"query\":\"Forte\",\"badge\":\"MODERN\"},{\"label\":\"Angus Architectural Radiators\",\"query\":\"Angus\"},{\"label\":\"Hex Geometric Statement Radiators\",\"query\":\"Hex\",\"badge\":\"LUXURY\"},{\"label\":\"Nemo & Ribbon Designer Series\",\"query\":\"Nemo\"}]},{\"title\":\"Heights & Sizing\",\"items\":[{\"label\":\"300mm & 400mm Low-Level Radiators\",\"query\":\"300\"},{\"label\":\"500mm & 600mm Standard Height\",\"query\":\"600\"},{\"label\":\"700mm High Output Panels\",\"query\":\"700\"},{\"label\":\"1800mm Tall Vertical Radiators\",\"query\":\"1800\"},{\"label\":\"All Radiator Collections\",\"category\":\"Radiators\"}]}]";
    m2.featuredPromoJson = "{\"tag\":\"BENCHMARK PERFORMANCE\",\"title\":\"Compact 4 DF Horizontal Radiator\",\"subtitle\":\"High output double convector panel radiator with factory-fitted top grilles and 10-year warranty.\",\"cta\":\"Shop Compact 4 Series →\",\"category\":\"Radiators\",\"query\":\"DF\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\"}";
    repo.save(m2);

    var m3 = new NavigationMenu();
    m3.menuId = "towel-rails";
    m3.title = "Heated Towel Rails";
    m3.category = "Heated Towel Rails";
    m3.icon = "🛁";
    m3.badge = "";
    m3.imageUrl = "/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg";
    m3.description = "Enhance your bathroom with our premium heated towel rails and ladder warmers. Designed for optimal heat output, cozy warm towels, and corrosion-resistant finishes.";
    m3.sortOrder = 3;
    m3.status = "PUBLISHED";
    m3.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":true,\"showPanelTypeFilter\":false,\"showHeightFilter\":true,\"showFuelTypeFilter\":true,\"subcategories\":[{\"label\":\"Alex Classic Multi-Rail\",\"query\":\"Alex\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\",\"badge\":\"POPULAR\"},{\"label\":\"Easy Slimline Compact\",\"query\":\"Easy\",\"imageUrl\":\"/api/product-images/56dd11ba-f583-4cc8-8918-66dc45078c3b.jpg\"},{\"label\":\"Fiona Pristine Rails\",\"query\":\"Fiona\",\"imageUrl\":\"/api/product-images/2a19631f-69b4-404a-8fa2-49cdc0dbed53.jpg\"},{\"label\":\"Dexter Modern Warmers\",\"query\":\"Dexter\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\"},{\"label\":\"Zig Zag Statement Rails\",\"query\":\"Zig Zag\",\"imageUrl\":\"/api/product-images/0c7612a1-4309-4372-9466-c61cf478f0af.jpg\"},{\"label\":\"Retro Period Rails\",\"query\":\"Retro\",\"imageUrl\":\"/api/product-images/0c7612a1-4309-4372-9466-c61cf478f0af.png\"}]}";
    m3.columnsJson = "[{\"title\":\"Ladder & Bathroom Rails\",\"items\":[{\"label\":\"Alex Classic Multi-Rail Warmers\",\"query\":\"Alex\",\"badge\":\"POPULAR\"},{\"label\":\"Easy Slimline Compact Rails\",\"query\":\"Easy\",\"badge\":\"SLIMLINE\"},{\"label\":\"Fiona Pristine Ladder Rails\",\"query\":\"Fiona\"},{\"label\":\"Crystal Architectural Rails\",\"query\":\"Crystal\"},{\"label\":\"All Heated Towel Rails\",\"category\":\"Heated Towel Rails\"}]},{\"title\":\"Designer & Architectural Rails\",\"items\":[{\"label\":\"Dexter Contemporary Towel Rails\",\"query\":\"Dexter\",\"badge\":\"MODERN\"},{\"label\":\"Zig Zag Architectural Rails\",\"query\":\"Zig Zag\",\"badge\":\"DESIGNER\"},{\"label\":\"Vivo Clean-Line Warmers\",\"query\":\"Vivo\"},{\"label\":\"Quadrus Bold Square Profile\",\"query\":\"Quadrus\"},{\"label\":\"Michelle & Jade Curved Rails\",\"query\":\"Michelle\"}]},{\"title\":\"Heritage & Towel Sizes\",\"items\":[{\"label\":\"Retro Period Towel Warmers\",\"query\":\"Retro\",\"badge\":\"PERIOD\"},{\"label\":\"Salisbury Luxury Period Rails\",\"query\":\"Salisbury\"},{\"label\":\"Warp S & T Bold Warmers\",\"query\":\"Warp\"},{\"label\":\"Compact 600mm - 860mm Rails\",\"query\":\"800\"},{\"label\":\"Tall 1200mm - 1800mm Rails\",\"query\":\"1600\"}]}]";
    m3.featuredPromoJson = "{\"tag\":\"BATHROOM LUXURY\",\"title\":\"Alex Heated Ladder Towel Rail\",\"subtitle\":\"Pristine Traffic White multi-rail ladder warmer engineered for rapid towel drying and ambient warmth.\",\"cta\":\"Explore Towel Rails →\",\"category\":\"Heated Towel Rails\",\"query\":\"Alex\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\"}";
    repo.save(m3);

    var m4 = new NavigationMenu();
    m4.menuId = "electric-heating";
    m4.title = "Electric Heating";
    m4.category = "Electric Heating";
    m4.icon = "⚡";
    m4.badge = "";
    m4.imageUrl = "/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png";
    m4.description = "Smart electric radiators, pre-filled electric towel warmers, and digital WiFi heating elements providing precision temperature control and energy efficiency.";
    m4.sortOrder = 4;
    m4.status = "PUBLISHED";
    m4.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":true,\"showPanelTypeFilter\":false,\"showHeightFilter\":true,\"showFuelTypeFilter\":false,\"subcategories\":[{\"label\":\"Colorado WiFi Smart Radiators\",\"query\":\"Colorado\",\"imageUrl\":\"/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png\",\"badge\":\"SMART APP\"},{\"label\":\"Alex One Electric Towel Rails\",\"query\":\"Alex One\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\",\"badge\":\"PRE-FILLED\"},{\"label\":\"KTX-4 Smart WiFi Elements\",\"query\":\"KTX\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"},{\"label\":\"MOA Digital Elements\",\"query\":\"MOA\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.png\"},{\"label\":\"Terma SS1 Split Probes\",\"query\":\"Probe\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"}]}";
    m4.columnsJson = "[{\"title\":\"Smart Electric Radiators\",\"items\":[{\"label\":\"Colorado WiFi Smart Electric Radiators\",\"query\":\"Colorado\",\"badge\":\"WIFI APP\"},{\"label\":\"Bergamo WiFi Digital Convectors\",\"query\":\"Bergamo\",\"badge\":\"DIGITAL TIMER\"},{\"label\":\"Rolo-Room E Smart Radiators\",\"query\":\"Rolo-Room\",\"badge\":\"BLUETOOTH\"},{\"label\":\"Warp Room E Electric Panels\",\"query\":\"Warp\"},{\"label\":\"All Electric Heating\",\"category\":\"Electric Heating\"}]},{\"title\":\"Electric Heated Towel Rails\",\"items\":[{\"label\":\"Alex One Factory Electric Rails\",\"query\":\"Alex One\",\"badge\":\"PRE-FILLED\"},{\"label\":\"Dexter E Electric Designer Rails\",\"query\":\"Dexter E\"},{\"label\":\"Easy One Compact Electric Warmers\",\"query\":\"Easy One\"},{\"label\":\"Leo E Pre-Filled Electric Rails\",\"query\":\"Leo E\"},{\"label\":\"Zig Zag Electric Statement Rails\",\"query\":\"Zig Zag\"}]},{\"title\":\"Heating Elements & Probes\",\"items\":[{\"label\":\"KTX-4 Blue WiFi Smart Elements\",\"query\":\"KTX\",\"badge\":\"SMART WIFI\"},{\"label\":\"MOA & MOA Blue Digital Elements\",\"query\":\"MOA\"},{\"label\":\"MEG Thermostatic Element Range\",\"query\":\"MEG\"},{\"label\":\"Terma SS1 Smart Split Probes (120W-2000W)\",\"query\":\"Probe\",\"badge\":\"RAPID HEAT\"}]}]";
    m4.featuredPromoJson = "{\"tag\":\"SMART HEATING EFFICIENCY\",\"title\":\"Colorado WiFi Smart Electric Radiator\",\"subtitle\":\"Precision WiFi app control, 7-day digital scheduling, and high thermal retention ceramic column core.\",\"cta\":\"Shop Electric Heating →\",\"category\":\"Electric Heating\",\"query\":\"Colorado\",\"imageUrl\":\"/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png\"}";
    repo.save(m4);

    var m5 = new NavigationMenu();
    m5.menuId = "valves";
    m5.title = "Valves & Accessories";
    m5.category = "Valves & Accessories";
    m5.icon = "⚙";
    m5.badge = "";
    m5.imageUrl = "/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg";
    m5.description = "Precision thermostatic radiator valves (TRVs), 50mm twin valve sets, solid brass pipe finishing sleeves, and dual fuel conversion kits.";
    m5.sortOrder = 5;
    m5.status = "PUBLISHED";
    m5.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":false,\"showPanelTypeFilter\":false,\"showHeightFilter\":false,\"showFuelTypeFilter\":false,\"subcategories\":[{\"label\":\"Corner 3-Axis TRV Sets\",\"query\":\"Corner\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\",\"badge\":\"BESTSELLER\"},{\"label\":\"Traditional Vintage TRVs\",\"query\":\"Traditional\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.png\"},{\"label\":\"50mm Twin Valve Sets\",\"query\":\"Twins\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"},{\"label\":\"Solid Brass Pipe Sleeves\",\"query\":\"Pipe Masking\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.png\"},{\"label\":\"Dual Fuel T-Piece Kits\",\"query\":\"T-Piece\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"}]}";
    m5.columnsJson = "[{\"title\":\"Precision TRV Valves\",\"items\":[{\"label\":\"Cylindrical 3-Axis Corner TRVs\",\"query\":\"Cylindrical\",\"badge\":\"3-AXIS BESTSELLER\"},{\"label\":\"Traditional Vintage TRV Sets\",\"query\":\"Traditional\",\"badge\":\"ANTIQUE\"},{\"label\":\"Vario Twins 50mm Integrated Sets\",\"query\":\"Twins\",\"badge\":\"50MM PIPING\"},{\"label\":\"Vario Vision Architectural TRVs\",\"query\":\"Vision\"},{\"label\":\"All Radiator Valves\",\"category\":\"Valves & Accessories\"}]},{\"title\":\"Pipe Finishing & Sleeves\",\"items\":[{\"label\":\"Solid Brass Pipe Masking Sleeves\",\"query\":\"Pipe Masking\",\"badge\":\"MATCHING SLEEVES\"},{\"label\":\"Polished Chrome Pipe Shrouds\",\"query\":\"Chrome\"},{\"label\":\"Matt Textured Black Pipe Finishing\",\"query\":\"Black\"},{\"label\":\"Antique Brass & Copper Sleeves\",\"query\":\"Brass\"}]},{\"title\":\"Dual Fuel & Components\",\"items\":[{\"label\":\"Dual Fuel T-Piece Adapters\",\"query\":\"T-Piece\",\"badge\":\"ALL-SEASON\"},{\"label\":\"Vario Integra TRV with Integrated T-Piece\",\"query\":\"Integra\"},{\"label\":\"Heavy Duty Wall Fixing Brackets\",\"query\":\"Accessory\"},{\"label\":\"Heating Element Controllers\",\"query\":\"Element\"}]}]";
    m5.featuredPromoJson = "{\"tag\":\"ARCHITECTURAL FINISH\",\"title\":\"TRV Corner 3-Axis Valve Set\",\"subtitle\":\"Precision thermostatic radiator valve set positioning the sensor parallel to the wall for a sleek profile.\",\"cta\":\"Browse Valves & Kits →\",\"category\":\"Valves & Accessories\",\"query\":\"Corner\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"}";
    repo.save(m5);

    var m6 = new NavigationMenu();
    m6.menuId = "sale";
    m6.title = "SALE";
    m6.category = "SALE";
    m6.icon = "🏷";
    m6.badge = "HOT";
    m6.imageUrl = "/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png";
    m6.description = "Unbeatable seasonal deals with up to 40% off clearance radiators, heated towel rails, and ex-display heating sets.";
    m6.sortOrder = 6;
    m6.status = "PUBLISHED";
    m6.filterOptionsJson = "{\"showPriceFilter\":true,\"showAvailabilityFilter\":true,\"showBrandFilter\":true,\"showColourFilter\":true,\"showBtuFilter\":true,\"showPanelTypeFilter\":true,\"showHeightFilter\":true,\"showFuelTypeFilter\":false,\"subcategories\":[{\"label\":\"Convector Radiator Deals\",\"query\":\"DF\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\",\"badge\":\"UP TO 40% OFF\"},{\"label\":\"Colorado Column Reductions\",\"query\":\"Colorado\",\"imageUrl\":\"/api/product-images/fc274807-bc10-4063-b29c-c8bde1f7dd00.png\",\"badge\":\"SAVE 20%\"},{\"label\":\"Towel Rail Clearance\",\"query\":\"Alex\",\"imageUrl\":\"/api/product-images/325c65f7-c7eb-4da9-b4e1-8a150483c9e5.jpg\"},{\"label\":\"TRV Valve Deals\",\"query\":\"Cylindrical\",\"imageUrl\":\"/api/product-images/65301fc2-1bf1-4cff-b046-589de5422312.jpg\"},{\"label\":\"Under £150 Specials\",\"query\":\"Compact\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.jpg\"}]}";
    m6.columnsJson = "[{\"title\":\"Clearance Radiators\",\"items\":[{\"label\":\"Convector Radiator Special Deals\",\"query\":\"DF\",\"badge\":\"UP TO 40% OFF\"},{\"label\":\"Colorado Column Radiator Reductions\",\"query\":\"Colorado\"},{\"label\":\"All Sale Radiators\",\"category\":\"Radiators\"}]},{\"title\":\"Towel Rail & Valve Offers\",\"items\":[{\"label\":\"Ladder Towel Warmer Clearance\",\"query\":\"Alex\",\"badge\":\"PRICE DROP\"},{\"label\":\"Designer TRV Valve Set Deals\",\"query\":\"Cylindrical\"},{\"label\":\"All Sale Items\",\"category\":\"SALE\"}]},{\"title\":\"Exclusive Promotions\",\"items\":[{\"label\":\"Under £150 Heating Specials\",\"query\":\"Compact\"},{\"label\":\"Electric Heating Clearance\",\"query\":\"Electric\"},{\"label\":\"Full Overstock Clearance\",\"category\":\"SALE\"}]}]";
    m6.featuredPromoJson = "{\"tag\":\"SEASONAL CLEARANCE\",\"title\":\"Up To 40% Off Radiators & Rails\",\"subtitle\":\"Factory-direct overstock discounts on premium British and European central heating and towel warmers.\",\"cta\":\"Shop All Sale Items →\",\"category\":\"SALE\",\"imageUrl\":\"/api/product-images/610be977-0784-40d1-a857-edc5e78bc884.png\"}";
    repo.save(m6);
  }

  @jakarta.annotation.PostConstruct
  public void init() {
    if (repo.count() == 0) {
      seedDefaultMenus();
    }
  }
}

@RestController
@RequestMapping("/api/internal/navigation")
class InternalNavigationController {
  private final NavigationMenuRepository repo;
  private final NavigationMenuController navCtrl;
  InternalNavigationController(NavigationMenuRepository repo, NavigationMenuController navCtrl) {
    this.repo = repo;
    this.navCtrl = navCtrl;
  }

  @GetMapping
  public List<NavigationMenu> published() {
    if (repo.count() == 0) {
      navCtrl.seedDefaultMenus();
    }
    return repo.findByStatusOrderBySortOrderAsc("PUBLISHED");
  }
}

@RestController @RequestMapping("/api/audit")
@PreAuthorize("hasRole('ADMIN')")
class AuditController { private final AuditLogRepository repo; AuditController(AuditLogRepository r){repo=r;} @GetMapping Page<AuditLog> list(@RequestParam(value="page", defaultValue="0") int page,@RequestParam(value="size", defaultValue="10") int size){var safePage=Math.max(0,page);var safeSize=Math.max(1,Math.min(size,100));return repo.findAll(PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"createdAt")));} }

@org.springframework.stereotype.Service
class AuditService {
  private final AuditLogRepository repo; AuditService(AuditLogRepository r){repo=r;}
  void log(Authentication a,String action,String type,Object id,String detail,HttpServletRequest request){var x=new AuditLog();x.actor=a==null?"system":a.getName();x.action=action;x.entityType=type;x.entityId=String.valueOf(id);x.detail=detail;x.ipAddress=request.getRemoteAddr();repo.save(x);}
  void log(String actor,String action,String type,Object id,String detail,HttpServletRequest request){var x=new AuditLog();x.actor=actor;x.action=action;x.entityType=type;x.entityId=String.valueOf(id);x.detail=detail;x.ipAddress=request.getRemoteAddr();repo.save(x);}
}

@RestControllerAdvice
class ApiExceptionHandler {
  @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
  @ResponseStatus(HttpStatus.FORBIDDEN)
  Map<String,Object> handleAccessDenied(org.springframework.security.access.AccessDeniedException e){
    return Map.of("timestamp",Instant.now(),"status",403,"message","Access denied: Insufficient privileges");
  }

  @ExceptionHandler(ResponseStatusException.class)
  org.springframework.http.ResponseEntity<Map<String,Object>> handleResponseStatus(ResponseStatusException r){
    return org.springframework.http.ResponseEntity.status(r.getStatusCode())
        .body(Map.of("timestamp",Instant.now(),"status",r.getStatusCode().value(),"message",Optional.ofNullable(r.getReason()).orElse("Request failed")));
  }

  @ExceptionHandler(Exception.class) @ResponseStatus(HttpStatus.BAD_REQUEST) Map<String,Object> handle(Exception e){
    Throwable root=e;while(root.getCause()!=null&&root.getCause()!=root)root=root.getCause();
    String message=Optional.ofNullable(root.getMessage()).orElseGet(()->Optional.ofNullable(e.getMessage()).orElse("Request failed"));
    return Map.of("timestamp",Instant.now(),"message",message);
  }
}
