package com.hearth.commerce.config;

import org.springframework.context.annotation.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.List;

@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder(12);}
  @Bean UserDetailsService users(PasswordEncoder encoder,
      @Value("${app.auth.customer-email:customer@example.com}") String customerEmail,
      @Value("${app.auth.customer-password:Customer123!}") String customerPassword,
      @Value("${app.auth.admin-email:admin@example.com}") String adminEmail,
      @Value("${app.auth.admin-password:Admin123!}") String adminPassword){
    return new InMemoryUserDetailsManager(
      User.withUsername(customerEmail).password(encoder.encode(customerPassword)).roles("CUSTOMER").build(),
      User.withUsername(adminEmail).password(encoder.encode(adminPassword)).roles("CUSTOMER","ADMIN").build()
    );
  }
  @Bean SecurityFilterChain filterChain(HttpSecurity http,CorsConfigurationSource cors) throws Exception {
    return http
      .csrf(csrf->csrf.disable()).cors(c->c.configurationSource(cors))
      .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .headers(h->h.frameOptions(f->f.deny()).contentTypeOptions(c->{})
        .contentSecurityPolicy(c->c.policyDirectives("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
        .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy","no-referrer"))
        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy","camera=(), microphone=(), geolocation=()")))
      .authorizeHttpRequests(a->a
        .requestMatchers(HttpMethod.GET,"/api/products/**","/api/categories").permitAll()
        .requestMatchers("/api/admin/**").hasRole("ADMIN")
        .requestMatchers("/api/**").authenticated()
        .anyRequest().permitAll())
      .httpBasic(Customizer.withDefaults()).build();
  }
  @Bean CorsConfigurationSource cors(@Value("${app.cors-origin}") String origins){
    var allowed=Arrays.stream(origins.split(",")).map(String::trim).filter(x->!x.isBlank()).toList();
    var c=new CorsConfiguration();c.setAllowedOrigins(allowed);c.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));c.setAllowedHeaders(List.of("Authorization","Content-Type"));c.setExposedHeaders(List.of("X-RateLimit-Limit","X-RateLimit-Remaining","Retry-After"));c.setAllowCredentials(false);c.setMaxAge(3600L);
    var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",c);return source;
  }
}
