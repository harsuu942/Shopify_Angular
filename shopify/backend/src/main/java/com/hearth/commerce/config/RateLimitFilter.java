package com.hearth.commerce.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
class RateLimitFilter extends OncePerRequestFilter {
  private record Window(long startedAt,AtomicInteger count) {}
  private final ConcurrentHashMap<String,Window> windows=new ConcurrentHashMap<>();
  private final int apiLimit; private final int authLimit;
  RateLimitFilter(@Value("${app.rate-limit.requests-per-minute:300}") int apiLimit,@Value("${app.rate-limit.auth-per-minute:20}") int authLimit){this.apiLimit=apiLimit;this.authLimit=authLimit;}

  @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws IOException,jakarta.servlet.ServletException {
    if(!req.getRequestURI().startsWith("/api/")){chain.doFilter(req,res);return;}
    var now=Instant.now().getEpochSecond();var auth=req.getRequestURI().equals("/api/me");var limit=auth?authLimit:apiLimit;var key=req.getRemoteAddr()+":"+(auth?"auth":"api");
    var window=windows.compute(key,(k,current)->current==null||now-current.startedAt()>=60?new Window(now,new AtomicInteger(1)):(current.count().incrementAndGet()>0?current:null));
    if(windows.size()>10000)windows.entrySet().removeIf(e->now-e.getValue().startedAt()>=60);
    res.setHeader("X-RateLimit-Limit",String.valueOf(limit));res.setHeader("X-RateLimit-Remaining",String.valueOf(Math.max(0,limit-window.count().get())));
    if(window.count().get()>limit){res.setStatus(429);res.setHeader("Retry-After","60");res.setContentType("application/json");res.getWriter().write("{\"message\":\"Too many requests. Try again shortly.\"}");return;}
    chain.doFilter(req,res);
  }
}
