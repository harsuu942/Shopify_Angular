package com.hearth.commerce.repo;

import com.hearth.commerce.domain.BlogPost;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {
    Optional<BlogPost> findBySlug(String slug);
    List<BlogPost> findByStatusOrderByCreatedAtDesc(String status);
    List<BlogPost> findByCategoryAndStatusOrderByCreatedAtDesc(String category, String status);
}
