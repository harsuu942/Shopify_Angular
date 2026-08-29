package com.hearth.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration @Profile("prod")
class ProductionBootstrap {
  @Bean CommandLineRunner bootstrapAdmin(AdminUserRepository users,PasswordEncoder encoder,
      @Value("${ADMIN_BOOTSTRAP_NAME:Production Admin}") String name,
      @Value("${ADMIN_BOOTSTRAP_EMAIL}") String email,
      @Value("${ADMIN_BOOTSTRAP_PASSWORD}") String password) {
    return args -> {
      if(users.count()!=0)return;
      if(password.length()<12)throw new IllegalStateException("ADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters");
      var user=new AdminUser();user.name=name;user.email=email;user.passwordHash=encoder.encode(password);user.role="ADMIN";users.save(user);
    };
  }
}
