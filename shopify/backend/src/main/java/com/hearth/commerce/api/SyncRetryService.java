package com.hearth.commerce.api;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.hearth.commerce.domain.FailedSyncTask;
import com.hearth.commerce.repo.FailedSyncTaskRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;

@Service
public class SyncRetryService {
  private final FailedSyncTaskRepository repo;
  private final RestClient restClient;
  private final String syncSecret;
  private final ObjectMapper objectMapper;

  public SyncRetryService(FailedSyncTaskRepository repo,
                          @Value("${app.admin-api-url}") String adminApiUrl,
                          @Value("${app.catalogue-sync-secret}") String syncSecret) {
    this.repo = repo;
    this.restClient = RestClient.builder().baseUrl(adminApiUrl).build();
    this.syncSecret = syncSecret;
    this.objectMapper = new JsonMapper();
  }

  public void executeOrQueue(String endpoint, Object payload) {
    try {
      restClient.post().uri(endpoint)
          .header("X-Catalogue-Sync-Secret", syncSecret)
          .contentType(MediaType.APPLICATION_JSON)
          .body(payload)
          .retrieve().toBodilessEntity();
    } catch (Exception e) {
      System.err.println("Sync failed to " + endpoint + " (" + e.getMessage() + "). Queuing for retry.");
      queueTask(endpoint, payload, e.getMessage());
    }
  }

  public void queueTask(String endpoint, Object payload, String error) {
    try {
      String json = payload instanceof String ? (String) payload : objectMapper.writeValueAsString(payload);
      FailedSyncTask task = new FailedSyncTask(endpoint, json);
      task.setLastError(error);
      task.setAttempts(1);
      task.setLastAttempt(Instant.now());
      repo.save(task);
    } catch (Exception ex) {
      System.err.println("Failed to persist sync task: " + ex.getMessage());
    }
  }

  @Scheduled(fixedDelay = 15000)
  public int retryPendingTasks() {
    List<FailedSyncTask> pending = repo.findByStatusOrderByCreatedAtAsc("PENDING");
    if (pending.isEmpty()) return 0;

    int successCount = 0;
    for (FailedSyncTask task : pending) {
      try {
        restClient.post().uri(task.getEndpoint())
            .header("X-Catalogue-Sync-Secret", syncSecret)
            .contentType(MediaType.APPLICATION_JSON)
            .body(task.getPayloadJson())
            .retrieve().toBodilessEntity();

        repo.delete(task);
        successCount++;
        System.out.println("Successfully retried sync task #" + task.getId() + " to " + task.getEndpoint());
      } catch (Exception ex) {
        task.setAttempts(task.getAttempts() + 1);
        task.setLastAttempt(Instant.now());
        task.setLastError(ex.getMessage());
        if (task.getAttempts() >= 20) {
          task.setStatus("FAILED");
        }
        repo.save(task);
        System.err.println("Retry failed for task #" + task.getId() + " (attempt " + task.getAttempts() + "): " + ex.getMessage());
      }
    }
    return successCount;
  }
}
