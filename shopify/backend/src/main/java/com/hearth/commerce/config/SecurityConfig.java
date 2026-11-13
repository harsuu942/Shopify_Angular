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
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.List;
import com.hearth.commerce.repo.AppUserRepository;

@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder(12);}
  @Bean UserDetailsService users(AppUserRepository users){
    return username->{var account=users.findByEmailIgnoreCase(username).orElseThrow(()->new UsernameNotFoundException("Account not found"));
      var builder=User.withUsername(account.getEmail()).password(account.getPasswordHash()).disabled(!account.isEnabled());
      return "ADMIN".equals(account.getRole())?builder.roles("CUSTOMER","ADMIN").build():builder.roles("CUSTOMER").build();};
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
        .requestMatchers("/api/inquiries/my").authenticated()
        .requestMatchers(HttpMethod.GET,"/api/products/**","/api/categories","/api/product-images/**","/api/cms/**","/api/blogs","/api/blogs/**","/api/orders/track/**","/api/reviews/**","/api/checkout/**","/api/inquiries/track/**","/api/settings/**").permitAll()
        .requestMatchers(HttpMethod.HEAD,"/api/products/**","/api/categories","/api/product-images/**","/api/cms/**","/api/blogs","/api/blogs/**","/api/orders/track/**","/api/reviews/**","/api/checkout/**","/api/inquiries/track/**","/api/settings/**").permitAll()
        .requestMatchers(HttpMethod.POST,"/api/reviews/*/helpful","/api/reviews").permitAll()
        .requestMatchers(HttpMethod.POST,"/api/reviews/*/approve","/api/reviews/*/reject").hasRole("ADMIN")
        .requestMatchers(HttpMethod.DELETE,"/api/reviews/**").hasRole("ADMIN")
        .requestMatchers(HttpMethod.POST,"/api/auth/login","/api/auth/signup","/api/auth/forgot-password","/api/auth/reset-password","/api/promotions/validate","/api/inquiries","/api/inquiries/upload","/api/inquiries/upload-attachment","/api/orders","/api/checkout/**","/api/webhooks/**").permitAll()
        .requestMatchers("/api/webhooks/**").permitAll()
        .requestMatchers("/api/internal/**").permitAll()
        .requestMatchers("/api/admin/**").hasRole("ADMIN")
        .requestMatchers("/api/**").authenticated()
        .anyRequest().permitAll())
      .exceptionHandling(e -> e.authenticationEntryPoint((request, response, authException) -> {
        response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Invalid email or password.\"}");
      }))
      .httpBasic(b -> b.authenticationEntryPoint((request, response, authException) -> {
        response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Invalid email or password.\"}");
      })).build();
  }
  @Bean @Primary CorsConfigurationSource cors(@Value("${app.cors-origin}") String origins){
    var c=new CorsConfiguration();c.setAllowedOriginPatterns(List.of("*"));c.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS"));c.setAllowedHeaders(List.of("Authorization","Content-Type"));c.setExposedHeaders(List.of("X-RateLimit-Limit","X-RateLimit-Remaining","Retry-After"));c.setAllowCredentials(false);c.setMaxAge(3600L);
    var source=new UrlBasedCorsConfigurationSource();source.registerCorsConfiguration("/**",c);return source;
  }
}
