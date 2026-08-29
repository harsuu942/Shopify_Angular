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
  @Query("""
    select p from Product p
    where p.archived = false
      and (:q = '' or lower(p.name) like lower(concat('%', :q, '%')) or lower(p.sku) like lower(concat('%', :q, '%')))
      and (:status = '' or p.status = :status)
    """)
  Page<Product> search(@Param("q") String q,@Param("status") String status,Pageable pageable);
  long countByArchivedFalse(); long countByArchivedFalseAndStockLessThanEqual(int stock); long countByArchivedFalseAndStatus(String status);
}
interface CustomerRepository extends JpaRepository<Customer,Long> { Page<Customer> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name,String email,Pageable p); }
interface QuotationRepository extends JpaRepository<Quotation,Long> { long countByStatus(String status); }
interface CommerceOrderRepository extends JpaRepository<CommerceOrder,Long> { long countByOrderStatus(String status); long countByPaymentStatus(String status); }
interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction,Long> {}
interface CmsContentRepository extends JpaRepository<CmsContent,Long> {}
interface AuditLogRepository extends JpaRepository<AuditLog,Long> {}
