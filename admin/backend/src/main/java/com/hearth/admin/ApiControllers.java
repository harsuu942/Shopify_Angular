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
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.Instant;
import java.time.LocalDate;
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
class DashboardController {
  private final ProductRepository products; private final CustomerRepository customers; private final QuotationRepository quotes; private final CommerceOrderRepository orders; private final AuditLogRepository audits;
  DashboardController(ProductRepository p,CustomerRepository c,QuotationRepository q,CommerceOrderRepository o,AuditLogRepository a){products=p;customers=c;quotes=q;orders=o;audits=a;}
  @GetMapping Map<String,Object> dashboard(){
    long revenue=orders.findAll().stream().filter(o->"PAID".equals(o.paymentStatus)).mapToLong(o->o.totalMinor).sum();
    return Map.of("revenueMinor",revenue,"orders",orders.count(),"customers",customers.count(),"products",products.countByArchivedFalse(),"lowStock",products.countByArchivedFalseAndStockLessThanEqual(10),"draftProducts",products.countByArchivedFalseAndStatus("DRAFT"),"openQuotes",quotes.countByStatus("SENT")+quotes.countByStatus("VIEWED"),"paymentExceptions",orders.countByPaymentStatus("FAILED"),"recentOrders",orders.findAll(PageRequest.of(0,5,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent(),"recentActivity",audits.findAll(PageRequest.of(0,6,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent());
  }
}

@RestController @RequestMapping("/api/products")
class ProductController {
  private final ProductRepository repo; private final AuditService audit;
  ProductController(ProductRepository repo,AuditService audit){this.repo=repo;this.audit=audit;}
  @GetMapping Page<Product> list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){var safePage=Math.max(0,page);var safeSize=Math.max(1,Math.min(size,100));return repo.search(q.trim(),status.trim().toUpperCase(),PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"updatedAt")));}
  @GetMapping("/{id}") Product get(@PathVariable Long id){return find(id);}
  @PostMapping @ResponseStatus(HttpStatus.CREATED) Product create(@RequestBody Product p,Authentication a,HttpServletRequest req){p.id=null;validate(p);var saved=repo.save(p);audit.log(a,"CREATE","PRODUCT",saved.id,"Created "+saved.sku,req);return saved;}
  @PutMapping("/{id}") Product update(@PathVariable Long id,@RequestBody Product p,Authentication a,HttpServletRequest req){var x=find(id);x.sku=p.sku;x.name=p.name;x.brand=p.brand;x.category=p.category;x.description=p.description;x.priceMinor=p.priceMinor;x.costMinor=p.costMinor;x.stock=p.stock;x.lowStockThreshold=p.lowStockThreshold;x.status=p.status;x.taxClass=p.taxClass;x.shippingClass=p.shippingClass;x.imageUrl=p.imageUrl;x.sourceUrl=p.sourceUrl;validate(x);var saved=repo.save(x);audit.log(a,"UPDATE","PRODUCT",id,"Updated "+saved.sku,req);return saved;}
  @PostMapping("/import") @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')") @Transactional Map<String,Integer> importProducts(@RequestBody List<Product> incoming,Authentication a,HttpServletRequest req){int created=0,updated=0;for(var p:incoming){validate(p);var existing=repo.findBySku(p.sku);if(existing.isPresent()){var x=existing.get();x.name=p.name;x.brand=p.brand;x.category=p.category;x.description=p.description;x.imageUrl=p.imageUrl;x.sourceUrl=p.sourceUrl;x.archived=false;repo.save(x);updated++;}else{p.id=null;repo.save(p);created++;}}audit.log(a,"IMPORT","PRODUCT","bulk","Imported "+created+" and updated "+updated+" products",req);return Map.of("created",created,"updated",updated,"total",incoming.size());}
  @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')") void archive(@PathVariable Long id,Authentication a,HttpServletRequest req){var p=find(id);p.archived=true;repo.save(p);audit.log(a,"ARCHIVE","PRODUCT",id,"Archived "+p.sku,req);}
  private Product find(Long id){return repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Product not found"));}
  private void validate(Product p){if(p.sku==null||p.sku.isBlank()||p.name==null||p.name.isBlank())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"SKU and name are required");if(p.priceMinor<0||p.costMinor<0)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Prices cannot be negative");if("PUBLISHED".equals(p.status)&&(p.category==null||p.category.isBlank()||p.priceMinor<=0))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Published products require category and price");}
}

@RestController @RequestMapping("/api/customers")
class CustomerController {
  private final CustomerRepository repo; CustomerController(CustomerRepository repo){this.repo=repo;}
  @GetMapping Page<Customer> list(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="0")int page){return repo.findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(q,q,PageRequest.of(page,20,Sort.by(Sort.Direction.DESC,"createdAt")));}
  @PostMapping Customer create(@RequestBody Customer x){x.id=null;return repo.save(x);}
  @PutMapping("/{id}") Customer update(@PathVariable Long id,@RequestBody Customer p){var x=repo.findById(id).orElseThrow();x.name=p.name;x.email=p.email;x.phone=p.phone;x.status=p.status;x.marketingConsent=p.marketingConsent;x.city=p.city;x.adminNotes=p.adminNotes;return repo.save(x);}
}

@RestController @RequestMapping("/api/quotations")
class QuotationController {
  private final QuotationRepository repo; QuotationController(QuotationRepository r){repo=r;}
  @GetMapping List<Quotation> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"createdAt"));}
  @PostMapping Quotation create(@RequestBody Quotation q){q.id=null;q.quoteNumber="QT-"+LocalDate.now().getYear()+"-"+String.format("%05d",repo.count()+1);q.totalMinor=q.subtotalMinor+q.taxMinor;if(q.expiresOn==null)q.expiresOn=LocalDate.now().plusDays(30);return repo.save(q);}
  @PutMapping("/{id}/status/{status}") Quotation status(@PathVariable Long id,@PathVariable String status){var q=repo.findById(id).orElseThrow();q.status=status.toUpperCase();return repo.save(q);}
}

@RestController @RequestMapping("/api/orders")
class OrderController {
  private final CommerceOrderRepository repo; OrderController(CommerceOrderRepository r){repo=r;}
  @GetMapping List<CommerceOrder> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"createdAt"));}
  @PostMapping CommerceOrder create(@RequestBody CommerceOrder o){o.id=null;o.orderNumber="ORD-"+LocalDate.now().getYear()+"-"+String.format("%05d",repo.count()+1);return repo.save(o);}
  @PutMapping("/{id}") CommerceOrder update(@PathVariable Long id,@RequestBody CommerceOrder p){var o=repo.findById(id).orElseThrow();o.orderStatus=p.orderStatus;o.paymentStatus=p.paymentStatus;o.fulfilmentStatus=p.fulfilmentStatus;o.warehouse=p.warehouse;o.trackingNumber=p.trackingNumber;return repo.save(o);}
}

@RestController @RequestMapping("/api/inventory")
class InventoryController {
  private final ProductRepository products; private final InventoryTransactionRepository txs; private final AuditService audit;
  InventoryController(ProductRepository p,InventoryTransactionRepository t,AuditService a){products=p;txs=t;audit=a;}
  @GetMapping List<InventoryTransaction> ledger(){return txs.findAll(PageRequest.of(0,100,Sort.by(Sort.Direction.DESC,"createdAt"))).getContent();}
  @PostMapping("/{productId}/adjust") @Transactional InventoryTransaction adjust(@PathVariable Long productId,@Valid @RequestBody StockRequest r,Authentication auth,HttpServletRequest req){var p=products.findById(productId).orElseThrow();int delta="REMOVE".equalsIgnoreCase(r.type())?-r.quantity():r.quantity();if(p.stock+delta<0)throw new ResponseStatusException(HttpStatus.CONFLICT,"Insufficient stock");var t=new InventoryTransaction();t.productId=p.id;t.sku=p.sku;t.productName=p.name;t.warehouse=r.warehouse();t.type=r.type().toUpperCase();t.quantityChange=delta;t.beforeQuantity=p.stock;t.afterQuantity=p.stock+delta;t.reason=r.reason();t.reference=r.reference();t.performedBy=auth.getName();p.stock=t.afterQuantity;products.save(p);txs.save(t);audit.log(auth,"ADJUST_STOCK","PRODUCT",p.id,r.reason()+" ("+delta+")",req);return t;}
}

@RestController @RequestMapping("/api/content")
class CmsController {
  private final CmsContentRepository repo; CmsController(CmsContentRepository r){repo=r;}
  @GetMapping List<CmsContent> list(){return repo.findAll(Sort.by(Sort.Direction.DESC,"updatedAt"));}
  @PostMapping CmsContent create(@RequestBody CmsContent c){c.id=null;return repo.save(c);}
  @PutMapping("/{id}") CmsContent update(@PathVariable Long id,@RequestBody CmsContent p){var c=repo.findById(id).orElseThrow();c.title=p.title;c.slug=p.slug;c.type=p.type;c.status=p.status;c.body=p.body;c.seoTitle=p.seoTitle;c.metaDescription=p.metaDescription;if("PUBLISHED".equals(c.status)&&c.publishedAt==null)c.publishedAt=Instant.now();return repo.save(c);}
}

@RestController @RequestMapping("/api/audit")
class AuditController { private final AuditLogRepository repo; AuditController(AuditLogRepository r){repo=r;} @GetMapping Page<AuditLog> list(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){var safePage=Math.max(0,page);var safeSize=Math.max(1,Math.min(size,100));return repo.findAll(PageRequest.of(safePage,safeSize,Sort.by(Sort.Direction.DESC,"createdAt")));} }

@org.springframework.stereotype.Service
class AuditService {
  private final AuditLogRepository repo; AuditService(AuditLogRepository r){repo=r;}
  void log(Authentication a,String action,String type,Object id,String detail,HttpServletRequest request){var x=new AuditLog();x.actor=a==null?"system":a.getName();x.action=action;x.entityType=type;x.entityId=String.valueOf(id);x.detail=detail;x.ipAddress=request.getRemoteAddr();repo.save(x);}
  void log(String actor,String action,String type,Object id,String detail,HttpServletRequest request){var x=new AuditLog();x.actor=actor;x.action=action;x.entityType=type;x.entityId=String.valueOf(id);x.detail=detail;x.ipAddress=request.getRemoteAddr();repo.save(x);}
}

@RestControllerAdvice
class ApiExceptionHandler {
  @ExceptionHandler(Exception.class) @ResponseStatus(HttpStatus.BAD_REQUEST) Map<String,Object> handle(Exception e){return Map.of("timestamp",Instant.now(),"message",e instanceof ResponseStatusException r?r.getReason():Optional.ofNullable(e.getMessage()).orElse("Request failed"));}
}
