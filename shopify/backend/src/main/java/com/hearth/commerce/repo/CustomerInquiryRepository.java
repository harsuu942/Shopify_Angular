package com.hearth.commerce.repo;

import com.hearth.commerce.domain.CustomerInquiry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CustomerInquiryRepository extends JpaRepository<CustomerInquiry, Long> {
  List<CustomerInquiry> findAllByOrderByCreatedAtDesc();
  List<CustomerInquiry> findByStatusOrderByCreatedAtDesc(String status);
  List<CustomerInquiry> findByEmailIgnoreCaseOrderByCreatedAtDesc(String email);
  java.util.Optional<CustomerInquiry> findByTicketNumber(String ticketNumber);
}
