package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="app_users", uniqueConstraints=@UniqueConstraint(name="uk_app_users_email", columnNames="email"))
public class AppUser {
  @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
  @Column(nullable=false,length=120) private String fullName;
  @Column(nullable=false,length=190) private String email;
  @Column(nullable=false,length=100) private String passwordHash;
  @Column(nullable=false,length=30) private String role;
  @Column(nullable=false) private boolean enabled;
  @Column(nullable=false,updatable=false) private Instant createdAt;
  @Column(nullable=false) private Instant updatedAt;

  @Column(length=100) private String resetToken;
  private Instant resetTokenExpiry;

  protected AppUser(){}
  public AppUser(String fullName,String email,String passwordHash,String role){
    this.fullName=fullName;this.email=email.trim().toLowerCase();this.passwordHash=passwordHash;
    this.role=role;this.enabled=true;this.createdAt=Instant.now();this.updatedAt=createdAt;
  }
  public Long getId(){return id;} public String getFullName(){return fullName;} public String getEmail(){return email;}
  public String getPasswordHash(){return passwordHash;} public void setPasswordHash(String passwordHash){this.passwordHash=passwordHash;this.updatedAt=Instant.now();}
  public String getRole(){return role;} public boolean isEnabled(){return enabled;} public void setEnabled(boolean enabled){this.enabled=enabled;this.updatedAt=Instant.now();}
  public Instant getCreatedAt(){return createdAt;} public Instant getUpdatedAt(){return updatedAt;}
  public String getResetToken(){return resetToken;}
  public void setResetToken(String token, Instant expiry){this.resetToken=token;this.resetTokenExpiry=expiry;this.updatedAt=Instant.now();}
  public boolean isResetTokenValid(String token){return this.resetToken!=null&&this.resetToken.equals(token)&&this.resetTokenExpiry!=null&&this.resetTokenExpiry.isAfter(Instant.now());}
  public void clearResetToken(){this.resetToken=null;this.resetTokenExpiry=null;this.updatedAt=Instant.now();}
}
