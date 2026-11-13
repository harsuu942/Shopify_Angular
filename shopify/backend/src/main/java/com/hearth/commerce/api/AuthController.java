package com.hearth.commerce.api;

import com.hearth.commerce.domain.AppUser;
import com.hearth.commerce.repo.AppUserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;
import java.util.Map;

@RestController @RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository users;
  private final PasswordEncoder encoder;
  private final SyncRetryService syncRetryService;

  AuthController(AppUserRepository users, PasswordEncoder encoder,
                 SyncRetryService syncRetryService){
    this.users = users;
    this.encoder = encoder;
    this.syncRetryService = syncRetryService;
  }

  @PostMapping("/signup")
  ResponseEntity<Map<String,Object>> signup(@Valid @RequestBody SignupRequest request){
    var email=request.email().trim().toLowerCase();
    if(users.existsByEmailIgnoreCase(email)) throw new ResponseStatusException(HttpStatus.CONFLICT,"An account already exists for this email");
    try{
      var saved=users.save(new AppUser(request.fullName().trim(),email,encoder.encode(request.password()),"CUSTOMER"));
      // Sync to Admin CRM via SyncRetryService
      syncRetryService.executeOrQueue("/api/internal/customers/sync", Map.of("fullName", saved.getFullName(), "email", saved.getEmail()));
      return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id",saved.getId(),"email",saved.getEmail(),"fullName",saved.getFullName()));
    }catch(DataIntegrityViolationException ex){throw new ResponseStatusException(HttpStatus.CONFLICT,"An account already exists for this email");}
  }

  @PostMapping("/login")
  public ResponseEntity<?> login(@RequestBody Map<String,String> body) {
    var email = body.getOrDefault("email", "").trim().toLowerCase();
    var password = body.getOrDefault("password", "");
    var userOpt = users.findByEmailIgnoreCase(email);
    if (userOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password."));
    }
    var user = userOpt.get();
    if (!user.isEnabled()) {
      return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Your account has been deactivated by administration. Please contact sales@theheatingandplumbing.com."));
    }
    if (!encoder.matches(password, user.getPasswordHash())) {
      return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password."));
    }
    String token = java.util.Base64.getEncoder().encodeToString((user.getEmail() + ":" + password).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    return ResponseEntity.ok(Map.of(
      "id", user.getId(),
      "email", user.getEmail(),
      "fullName", user.getFullName(),
      "role", user.getRole(),
      "token", token
    ));
  }

  @PostMapping("/forgot-password")
  public ResponseEntity<?> forgotPassword(@RequestBody Map<String,String> body) {
    var email = body.getOrDefault("email", "").trim().toLowerCase();
    if (email.isBlank() || !email.contains("@")) {
      return ResponseEntity.badRequest().body(Map.of("message", "Please enter a valid email address."));
    }
    var userOpt = users.findByEmailIgnoreCase(email);
    if (userOpt.isEmpty()) {
      return ResponseEntity.ok(Map.of("message", "If an account exists with this email address, a password reset code has been sent."));
    }
    var user = userOpt.get();
    String code = String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
    user.setResetToken(code, java.time.Instant.now().plus(15, java.time.temporal.ChronoUnit.MINUTES));
    users.save(user);
    return ResponseEntity.ok(Map.of(
      "message", "A 6-digit password reset verification code has been generated.",
      "devCode", code,
      "email", user.getEmail()
    ));
  }

  @PostMapping("/reset-password")
  public ResponseEntity<?> resetPassword(@RequestBody Map<String,String> body) {
    var email = body.getOrDefault("email", "").trim().toLowerCase();
    var code = body.getOrDefault("code", "").trim();
    var newPassword = body.getOrDefault("newPassword", "");
    if (email.isBlank() || code.isBlank() || newPassword.isBlank()) {
      return ResponseEntity.badRequest().body(Map.of("message", "Email, verification code, and new password are required."));
    }
    if (newPassword.length() < 6) {
      return ResponseEntity.badRequest().body(Map.of("message", "New password must be at least 6 characters long."));
    }
    var userOpt = users.findByEmailIgnoreCase(email);
    if (userOpt.isEmpty()) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid reset code or email address."));
    }
    var user = userOpt.get();
    if (!user.isResetTokenValid(code)) {
      return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid or expired verification code. Please request a new code."));
    }
    user.setPasswordHash(encoder.encode(newPassword));
    user.clearResetToken();
    users.save(user);
    return ResponseEntity.ok(Map.of("success", true, "message", "Your password has been successfully reset! You can now sign in with your new password."));
  }

  public record SignupRequest(
      @NotBlank(message="Full name is required") @Size(min=2,max=120,message="Full name must be at least 2 characters") String fullName,
      @NotBlank(message="Email address is required") @Email(message="Please enter a valid email address") @Size(max=190) String email,
      @NotBlank(message="Password is required") @Size(min=6,max=72,message="Password must be at least 6 characters") String password){}
}
