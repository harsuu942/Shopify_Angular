package com.hearth.commerce.api;

import com.hearth.commerce.domain.*;
import com.hearth.commerce.repo.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

@RestController @RequestMapping("/api")
public class StoreController {
  private final ProductRepository products; private final OrderRepository orders;
  StoreController(ProductRepository products,OrderRepository orders){this.products=products;this.orders=orders;}

  @GetMapping("/products")
  List<Product> products(@RequestParam(defaultValue="") String q,@RequestParam(defaultValue="") String category){
    var found=q.isBlank()?products.findAll():products.findByNameContainingIgnoreCaseOrSkuContainingIgnoreCaseOrBrandContainingIgnoreCase(q,q,q);
    return category.isBlank()?found:found.stream().filter(p->p.getCategory().equalsIgnoreCase(category)).toList();
  }
  @GetMapping("/products/{id}") Product product(@PathVariable Long id){return products.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));}
  @GetMapping("/categories") List<String> categories(){return products.findAll().stream().map(Product::getCategory).distinct().sorted().toList();}
  @GetMapping("/me") Map<String,Object> me(Authentication auth){return Map.of("email",auth.getName(),"admin",auth.getAuthorities().stream().anyMatch(a->a.getAuthority().equals("ROLE_ADMIN")));}
  @PostMapping("/orders") ResponseEntity<CustomerOrder> checkout(@Valid @RequestBody CheckoutRequest request, Authentication auth){
    if(request.items().isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Cart is empty");
    BigDecimal total=request.items().stream().map(i->products.findById(i.productId()).orElseThrow(()->new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid product")).getPrice().multiply(BigDecimal.valueOf(i.quantity()))).reduce(BigDecimal.ZERO,BigDecimal::add);
    String compact=request.items().stream().map(i->i.productId()+":"+i.quantity()).reduce((a,b)->a+","+b).orElse("");
    return ResponseEntity.status(HttpStatus.CREATED).body(orders.save(new CustomerOrder(auth.getName(),compact,total,request.shippingAddress())));
  }
  @GetMapping("/orders") List<CustomerOrder> orders(Authentication auth){return orders.findByCustomerEmailOrderByCreatedAtDesc(auth.getName());}
  @GetMapping("/admin/summary") Map<String,Object> summary(){return Map.of("products",products.count(),"orders",orders.count(),"lowStock",products.findAll().stream().filter(p->p.getStock()<10).count(),"revenue",orders.findAll().stream().map(CustomerOrder::getTotal).reduce(BigDecimal.ZERO,BigDecimal::add));}
  public record CartLine(@NotNull Long productId,@Min(1) @Max(99) int quantity){}
  public record CheckoutRequest(@NotEmpty List<@Valid CartLine> items,@NotBlank @Size(max=300) String shippingAddress){}
}
