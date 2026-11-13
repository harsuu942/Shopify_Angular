package com.hearth.commerce.config;

import com.hearth.commerce.domain.ProductReview;
import com.hearth.commerce.repo.ProductRepository;
import com.hearth.commerce.repo.ProductReviewRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Configuration
public class ReviewDataSeeder {

  @Bean
  CommandLineRunner seedReviews(ProductReviewRepository reviewRepo, ProductRepository productRepo) {
    return args -> {
      if (reviewRepo.findAll().stream().noneMatch(r -> "Sarah Jenkins".equalsIgnoreCase(r.getAuthor()))) {
        var p1 = productRepo.findById(1L).orElse(null);
        var p2 = productRepo.findById(2L).orElse(null);
        var p3 = productRepo.findById(3L).orElse(null);
        var p4 = productRepo.findById(4L).orElse(null);

        List<ProductReview> seeds = List.of(
          new ProductReview(
            p1 != null ? p1.getId() : 1L,
            p1 != null ? p1.getSku() : "H2100022",
            "Radiators",
            "Sarah Jenkins",
            "sarah.jenkins@example.co.uk",
            "cust_sarah_j",
            "Harrogate, North Yorkshire",
            "Verified Homeowner",
            5,
            "Stunning quality & superb warmth",
            "Replaced our cold ground floor radiators during a renovation. The heat output is incredible, warming our open-plan living room in minutes. Solid build quality and fast courier delivery.",
            "APPROVED",
            true
          ),
          new ProductReview(
            p2 != null ? p2.getId() : 2L,
            p2 != null ? p2.getSku() : "H2100023",
            "Heated Towel Rails",
            "Michael Thornton",
            "m.thornton@example.co.uk",
            "cust_mike_t",
            "Cotswolds, Gloucestershire",
            "Verified Homeowner",
            5,
            "Luxury bathroom centerpiece",
            "The finish is immaculate and feels far more premium than high street brands. Towels are always toasty, and installation was straightforward for our plumber. Highly recommended.",
            "APPROVED",
            true
          ),
          new ProductReview(
            p3 != null ? p3.getId() : 3L,
            p3 != null ? p3.getSku() : "H2100024",
            "Valves & Accessories",
            "David & Claire Edwards",
            "edwards.family@example.co.uk",
            "cust_edwards_d",
            "Cheshire, UK",
            "Verified Homeowner",
            5,
            "Precision thermostatic control",
            "Matched these brushed brass TRVs with our column radiators. Temperature control is whisper-quiet and precise. The weighted solid brass feels like it will last decades.",
            "APPROVED",
            true
          ),
          new ProductReview(
            p4 != null ? p4.getId() : 4L,
            p4 != null ? p4.getSku() : "H2100025",
            "Electric Heating",
            "Elena Rostova",
            "elena.rostova@example.co.uk",
            "cust_elena_r",
            "Edinburgh, Scotland",
            "Verified Homeowner",
            5,
            "Energy-efficient smart warmth",
            "Installed this electric convector in our loft conversion where pipework wasn't possible. The built-in thermostat keeps the room exactly at 21°C without energy waste.",
            "APPROVED",
            true
          ),
          new ProductReview(
            p1 != null ? p1.getId() : 1L,
            p1 != null ? p1.getSku() : "H2100022",
            "Radiators",
            "Oliver Barnes",
            "oliver.barnes.plumbing@example.co.uk",
            "cust_oliver_b",
            "Surrey, UK",
            "Heating Engineer & Installer",
            5,
            "Trade grade build & 20-year guarantee",
            "As a heating installer, THP products are my first recommendation to clients. True European steel gauge, no weld imperfections, and the 20-year warranty gives total peace of mind.",
            "APPROVED",
            true
          ),
          new ProductReview(
            p2 != null ? p2.getId() : 2L,
            p2 != null ? p2.getSku() : "H2100023",
            "Bathrooms",
            "Marcus Davies",
            "marcus.davies@example.co.uk",
            "cust_marcus_d",
            "Kensington, London",
            "Architect & Specifier",
            5,
            "Architectural perfection",
            "Specified for a full residential refurbishment in London. Client is thrilled with the aesthetic balance and high thermal efficiency. Delivered palletised with zero transit damage.",
            "APPROVED",
            true
          )
        );

        int daysAgo = 12;
        for (var rev : seeds) {
          rev.setCreatedAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS));
          rev.setHelpfulCount(Math.max(1, 15 - daysAgo));
          daysAgo -= 2;
          reviewRepo.save(rev);
        }
      }
    };
  }
}
