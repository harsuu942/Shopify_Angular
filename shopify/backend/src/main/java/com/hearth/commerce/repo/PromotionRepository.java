package com.hearth.commerce.repo;

import com.hearth.commerce.domain.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
  Optional<Promotion> findByCodeIgnoreCase(String code);
  List<Promotion> findByActiveTrue();
}
