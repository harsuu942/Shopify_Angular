package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "failed_sync_tasks")
public class FailedSyncTask {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String endpoint;

  @Column(length = 8000, nullable = false)
  private String payloadJson;

  private int attempts = 0;

  @Column(nullable = false)
  private Instant createdAt = Instant.now();

  private Instant lastAttempt;

  private String lastError;

  @Column(nullable = false)
  private String status = "PENDING";

  protected FailedSyncTask() {}

  public FailedSyncTask(String endpoint, String payloadJson) {
    this.endpoint = endpoint;
    this.payloadJson = payloadJson;
    this.createdAt = Instant.now();
    this.status = "PENDING";
  }

  public Long getId() { return id; }
  public String getEndpoint() { return endpoint; }
  public String getPayloadJson() { return payloadJson; }
  public int getAttempts() { return attempts; }
  public void setAttempts(int attempts) { this.attempts = attempts; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getLastAttempt() { return lastAttempt; }
  public void setLastAttempt(Instant lastAttempt) { this.lastAttempt = lastAttempt; }
  public String getLastError() { return lastError; }
  public void setLastError(String lastError) { this.lastError = lastError; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
