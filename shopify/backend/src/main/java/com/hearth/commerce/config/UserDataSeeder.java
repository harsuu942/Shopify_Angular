package com.hearth.commerce.config;

import com.hearth.commerce.domain.AppUser;
import com.hearth.commerce.repo.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration @Profile("!prod & !render")
public class UserDataSeeder {
  @Bean CommandLineRunner seedUsers(AppUserRepository users,PasswordEncoder encoder,
      @Value("${app.auth.customer-email:customer@example.com}") String customerEmail,
      @Value("${app.auth.customer-password:Customer123!}") String customerPassword,
      @Value("${app.auth.admin-email:admin@example.com}") String adminEmail,
      @Value("${app.auth.admin-password:Admin123!}") String adminPassword){
    return args->{
      if(!users.existsByEmailIgnoreCase(customerEmail)) users.save(new AppUser("Demo Customer",customerEmail,encoder.encode(customerPassword),"CUSTOMER"));
      if(!users.existsByEmailIgnoreCase(adminEmail)) users.save(new AppUser("Store Administrator",adminEmail,encoder.encode(adminPassword),"ADMIN"));
    };
  }
}

@Configuration @Profile("render")
class ProductionUserHardening {
  @Bean CommandLineRunner disableDocumentedDemoAdmin(AppUserRepository users, PasswordEncoder encoder) {
    return args -> users.findByEmailIgnoreCase("admin@example.com")
        .filter(user -> "ADMIN".equalsIgnoreCase(user.getRole()))
        .filter(user -> encoder.matches("Admin123!", user.getPasswordHash()))
        .ifPresent(user -> { user.setEnabled(false); users.save(user); });
  }
}
