package com.hearth.commerce.repo;

import com.hearth.commerce.domain.FailedSyncTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FailedSyncTaskRepository extends JpaRepository<FailedSyncTask, Long> {
  List<FailedSyncTask> findByStatusOrderByCreatedAtAsc(String status);
  long countByStatus(String status);
}
