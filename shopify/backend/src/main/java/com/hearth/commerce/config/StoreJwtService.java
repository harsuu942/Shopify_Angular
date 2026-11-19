package com.hearth.commerce.config;

import com.hearth.commerce.domain.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Component
public class StoreJwtService {
  private final SecretKey key;
  private final long minutes;

  public StoreJwtService(@Value("${app.jwt.secret}") String secret,
                         @Value("${app.jwt.expiration-minutes:60}") long minutes) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalStateException("JWT_SECRET must be at least 32 characters");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.minutes = minutes;
  }

  public String create(AppUser user) {
    Instant now = Instant.now();
    return Jwts.builder().subject(user.getEmail()).claim("role", user.getRole())
        .issuedAt(Date.from(now)).expiration(Date.from(now.plus(minutes, ChronoUnit.MINUTES)))
        .signWith(key).compact();
  }

  Claims parse(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
  }
}
