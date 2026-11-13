package com.hearth.commerce.repo;

import com.hearth.commerce.domain.ProductReview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ProductReviewRepository extends JpaRepository<ProductReview, Long> {
  List<ProductReview> findAllByOrderByCreatedAtDesc();
  List<ProductReview> findByStatusOrderByCreatedAtDesc(String status);
  List<ProductReview> findByProductIdAndStatusOrderByCreatedAtDesc(Long productId, String status);
  List<ProductReview> findByCategoryIgnoreCaseAndStatusOrderByCreatedAtDesc(String category, String status);
  long countByStatus(String status);
}
