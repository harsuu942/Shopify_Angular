package com.hearth.admin;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Configuration @EnableMethodSecurity
class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
  @Bean SecurityFilterChain chain(HttpSecurity http, JwtFilter jwt, CorsConfigurationSource cors) throws Exception {
    return http.csrf(c->c.disable()).cors(c->c.configurationSource(cors))
      .sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(a->a.requestMatchers("/api/auth/login","/actuator/health","/api/internal/**").permitAll().requestMatchers(HttpMethod.GET,"/api/product-images/**","/api/products/import-workbook/sample").permitAll().anyRequest().authenticated())
      .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
      .headers(h->h.frameOptions(f->f.deny()).contentTypeOptions(c->{})
        .contentSecurityPolicy(c->c.policyDirectives("default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
        .addHeaderWriter(new StaticHeadersWriter("Referrer-Policy","no-referrer"))
        .addHeaderWriter(new StaticHeadersWriter("Permissions-Policy","camera=(), microphone=(), geolocation=()")))
      .build();
  }
  @Bean @org.springframework.context.annotation.Primary CorsConfigurationSource cors(@Value("${app.cors-origin}") String origins) {
    var c=new CorsConfiguration(); c.setAllowedOriginPatterns(List.of("*")); c.setAllowedMethods(List.of("GET","POST","PUT","DELETE","OPTIONS")); c.setAllowedHeaders(List.of("Authorization","Content-Type"));c.setExposedHeaders(List.of("X-RateLimit-Limit","X-RateLimit-Remaining","Retry-After"));c.setAllowCredentials(false);c.setMaxAge(3600L);
    var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**",c); return source;
  }
}

@Component
class JwtService {
  private final SecretKey key; private final long minutes;
  JwtService(@Value("${app.jwt.secret}") String secret,@Value("${app.jwt.expiration-minutes}") long minutes) { this.key=Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)); this.minutes=minutes; }
  String create(AdminUser u) { var now=Instant.now(); return Jwts.builder().subject(u.email).claim("name",u.name).claim("role",u.role).issuedAt(java.util.Date.from(now)).expiration(java.util.Date.from(now.plus(minutes,ChronoUnit.MINUTES))).signWith(key).compact(); }
  io.jsonwebtoken.Claims parse(String token) { return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload(); }
}

@Component
class JwtFilter extends OncePerRequestFilter {
  private final JwtService jwt; JwtFilter(JwtService jwt){this.jwt=jwt;}
  protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws java.io.IOException,jakarta.servlet.ServletException {
    var h=req.getHeader(HttpHeaders.AUTHORIZATION);
    if(h!=null&&h.startsWith("Bearer ")) try { var c=jwt.parse(h.substring(7)); var role=String.valueOf(c.get("role")); var auth=new UsernamePasswordAuthenticationToken(c.getSubject(),null,List.of(new SimpleGrantedAuthority("ROLE_"+role))); org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth); } catch(Exception ignored) {}
    chain.doFilter(req,res);
  }
}
