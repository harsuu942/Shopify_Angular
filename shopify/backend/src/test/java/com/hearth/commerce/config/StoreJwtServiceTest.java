package com.hearth.commerce.config;

import com.hearth.commerce.domain.AppUser;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class StoreJwtServiceTest {
  @Test
  void tokenContainsIdentityAndRoleWithoutPassword() {
    StoreJwtService service = new StoreJwtService("0123456789abcdef0123456789abcdef0123456789abcdef", 30);
    AppUser user = new AppUser("Jane Customer", "jane@example.com", "bcrypt-hash", "CUSTOMER");
    String token = service.create(user);

    assertEquals(3, token.split("\\.").length);
    assertEquals("jane@example.com", service.parse(token).getSubject());
    assertEquals("CUSTOMER", service.parse(token).get("role"));
    assertFalse(token.contains("bcrypt-hash"));
  }
}
