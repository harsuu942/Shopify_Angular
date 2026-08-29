package com.hearth.commerce.repo;
import com.hearth.commerce.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProductRepository extends JpaRepository<Product,Long> {
  List<Product> findByNameContainingIgnoreCaseOrSkuContainingIgnoreCaseOrBrandContainingIgnoreCase(String name,String sku,String brand);
}
