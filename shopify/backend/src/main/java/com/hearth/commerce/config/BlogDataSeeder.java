package com.hearth.commerce.config;

import com.hearth.commerce.domain.BlogPost;
import com.hearth.commerce.repo.BlogPostRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import javax.sql.DataSource;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

@Configuration
public class BlogDataSeeder {

    @Bean
    CommandLineRunner seedBlogsAndCleanUltraheat(BlogPostRepository blogRepo, DataSource dataSource) {
        return args -> {
            // 1. Permanent database sanitization: remove "Ultraheat" from all product names, brands, descriptions
            try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
                stmt.executeUpdate("UPDATE products SET name = TRIM(REPLACE(name, 'Ultraheat ', '')) WHERE name LIKE '%Ultraheat%'");
                stmt.executeUpdate("UPDATE products SET name = TRIM(REPLACE(name, 'Ultraheat', '')) WHERE name LIKE '%Ultraheat%'");
                stmt.executeUpdate("UPDATE products SET brand = 'THP Heating' WHERE brand = 'Ultraheat' OR brand LIKE '%Ultraheat%'");
                stmt.executeUpdate("UPDATE products SET description = TRIM(REPLACE(description, 'Ultraheat ', '')) WHERE description LIKE '%Ultraheat%'");
                stmt.executeUpdate("UPDATE products SET description = TRIM(REPLACE(description, 'Ultraheat', '')) WHERE description LIKE '%Ultraheat%'");
                try {
                    stmt.executeUpdate("UPDATE blog_posts SET category = 'Inspiration' WHERE category = 'Lifestyle'");
                } catch (Exception ignored) {}
            } catch (Exception e) {
                System.err.println("Database sanitization notice: " + e.getMessage());
            }

            // 2. Seed blog posts from blogs.json if table is empty
            if (blogRepo.count() == 0) {
                try {
                    ClassPathResource res = new ClassPathResource("blogs.json");
                    if (res.exists()) {
                        try (InputStream is = res.getInputStream()) {
                            ObjectMapper mapper = new JsonMapper();
                            List<Map<String, Object>> list = mapper.readValue(is, List.class);
                            for (Map<String, Object> map : list) {
                                BlogPost bp = new BlogPost();
                                bp.slug = String.valueOf(map.get("slug"));
                                bp.title = String.valueOf(map.get("title"));
                                bp.excerpt = String.valueOf(map.get("excerpt"));
                                bp.content = String.valueOf(map.get("content"));
                                bp.coverImage = String.valueOf(map.get("coverImage"));
                                bp.category = String.valueOf(map.get("category"));
                                bp.tags = String.valueOf(map.get("tags"));
                                bp.author = String.valueOf(map.get("author"));
                                bp.publishedAt = String.valueOf(map.get("publishedAt"));
                                bp.status = String.valueOf(map.getOrDefault("status", "PUBLISHED"));
                                if (map.get("readTimeMinutes") != null) {
                                    bp.readTimeMinutes = Integer.parseInt(String.valueOf(map.get("readTimeMinutes")));
                                }
                                blogRepo.save(bp);
                            }
                            System.out.println("✓ Seeded " + blogRepo.count() + " Heat & Plumb blog posts into Storefront database.");
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Could not seed blogs from blogs.json: " + e.getMessage());
                }
            }
        };
    }
}
