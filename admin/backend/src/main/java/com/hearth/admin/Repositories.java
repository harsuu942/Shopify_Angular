package com.hearth.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

interface AdminUserRepository extends JpaRepository<AdminUser,Long> { Optional<AdminUser> findByEmailIgnoreCase(String email); }
interface ProductRepository extends JpaRepository<Product,Long> {
  Optional<Product> findBySku(String sku);
  Optional<Product> findByVariantsEan(String ean);
  @Query("""
    select distinct p from Product p left join p.variants v
    where p.archived = false
      and (:q = '' or lower(p.name) like lower(concat('%', :q, '%'))
           or lower(p.sku) like lower(concat('%', :q, '%'))
           or lower(p.brand) like lower(concat('%', :q, '%'))
           or lower(p.category) like lower(concat('%', :q, '%'))
           or lower(v.variantSku) like lower(concat('%', :q, '%'))
           or lower(v.ean) like lower(concat('%', :q, '%')))
      and (:status = '' or p.status = :status)
      and (:brand = '' or lower(p.brand) = lower(:brand))
    """)
  Page<Product> search(@Param("q") String q,@Param("status") String status,@Param("brand") String brand,Pageable pageable);
  long countByArchivedFalse(); long countByArchivedFalseAndStockLessThanEqual(int stock); long countByArchivedFalseAndStatus(String status);
}
interface BrandRepository extends JpaRepository<Brand,Long> {
  Optional<Brand> findByNameIgnoreCase(String name);
  java.util.List<Brand> findAllByOrderBySortOrderAscNameAsc();
}
interface ProductVariantRepository extends JpaRepository<ProductVariant,Long> { Optional<ProductVariant> findByEan(String ean); }
interface CustomerRepository extends JpaRepository<Customer,Long> {
  Page<Customer> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name,String email,Pageable p);
  Optional<Customer> findByEmailIgnoreCase(String email);
}
interface QuotationRepository extends JpaRepository<Quotation,Long> { long countByStatus(String status); }
interface CommerceOrderRepository extends JpaRepository<CommerceOrder,Long> {
  long countByOrderStatus(String status);
  long countByPaymentStatus(String status);
  Optional<CommerceOrder> findByOrderNumber(String orderNumber);
}
interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction,Long> {}
interface CmsContentRepository extends JpaRepository<CmsContent,Long> {
  java.util.List<CmsContent> findByStatus(String status);
  Optional<CmsContent> findBySlugAndStatus(String slug, String status);
  java.util.List<CmsContent> findByTypeOrderBySortOrderAsc(String type);
  java.util.List<CmsContent> findByTypeAndStatusOrderBySortOrderAsc(String type, String status);
}
interface AuditLogRepository extends JpaRepository<AuditLog,Long> {}
interface PromotionRepository extends JpaRepository<Promotion,Long> {
  Optional<Promotion> findByCodeIgnoreCase(String code);
  java.util.List<Promotion> findByActiveTrue();
}
interface CustomerInquiryRepository extends JpaRepository<CustomerInquiry,Long> {
  java.util.List<CustomerInquiry> findAllByOrderByCreatedAtDesc();
  java.util.List<CustomerInquiry> findByStatusOrderByCreatedAtDesc(String status);
  long countByStatus(String status);
}
interface ProductReviewRepository extends JpaRepository<ProductReview,Long> {
  java.util.List<ProductReview> findAllByOrderByCreatedAtDesc();
  java.util.List<ProductReview> findByStatusOrderByCreatedAtDesc(String status);
  long countByStatus(String status);
  Optional<ProductReview> findByStoreReviewId(Long storeReviewId);
}
interface BlogPostRepository extends JpaRepository<BlogPost,Long> {
  Optional<BlogPost> findBySlug(String slug);
  java.util.List<BlogPost> findByStatusOrderByCreatedAtDesc(String status);
  java.util.List<BlogPost> findByCategoryAndStatusOrderByCreatedAtDesc(String category, String status);
  java.util.List<BlogPost> findAllByOrderByCreatedAtDesc();
}
interface NavigationMenuRepository extends JpaRepository<NavigationMenu,Long> {
  Optional<NavigationMenu> findByMenuId(String menuId);
  java.util.List<NavigationMenu> findAllByOrderBySortOrderAsc();
  java.util.List<NavigationMenu> findByStatusOrderBySortOrderAsc(String status);
}

