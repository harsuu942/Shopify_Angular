package com.hearth.commerce.repo;
import com.hearth.commerce.domain.CustomerOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface OrderRepository extends JpaRepository<CustomerOrder,String> {
  List<CustomerOrder> findByCustomerEmailOrderByCreatedAtDesc(String email);
}
