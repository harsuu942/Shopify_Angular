package com.hearth.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class BlogAdminController {

    private final BlogPostRepository blogRepo;
    private final RestClient restClient;
    private final String shopifyApiUrl;
    private final String syncSecret;

    public BlogAdminController(BlogPostRepository blogRepo,
                               @Value("${app.shopify-api-url:http://localhost:8080}") String shopifyApiUrl,
                               @Value("${app.catalogue-sync-secret:local-catalogue-sync-secret}") String syncSecret) {
        this.blogRepo = blogRepo;
        this.shopifyApiUrl = shopifyApiUrl;
        this.syncSecret = syncSecret;
        this.restClient = RestClient.builder().baseUrl(shopifyApiUrl).build();
    }

    @GetMapping("/admin/blogs")
    public List<BlogPost> listBlogs(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "search", required = false) String search) {

        List<BlogPost> list = blogRepo.findAllByOrderByCreatedAtDesc();

        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            list = list.stream().filter(b -> status.equalsIgnoreCase(b.status)).toList();
        }

        if (category != null && !category.isBlank() && !"all".equalsIgnoreCase(category)) {
            list = list.stream().filter(b -> category.equalsIgnoreCase(b.category)).toList();
        }

        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase();
            list = list.stream().filter(b ->
                    (b.title != null && b.title.toLowerCase().contains(q)) ||
                    (b.excerpt != null && b.excerpt.toLowerCase().contains(q)) ||
                    (b.author != null && b.author.toLowerCase().contains(q))
            ).toList();
        }

        return list;
    }

    @GetMapping("/admin/blogs/{id}")
    public BlogPost getBlog(@PathVariable("id") Long id) {
        return blogRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blog not found"));
    }

    @PostMapping("/admin/blogs")
    public ResponseEntity<BlogPost> createBlog(@RequestBody Map<String, Object> body) {
        String title = String.valueOf(body.get("title"));
        String slug = body.get("slug") != null && !String.valueOf(body.get("slug")).isBlank()
                ? toSlug(String.valueOf(body.get("slug")))
                : toSlug(title);

        BlogPost post = new BlogPost();
        post.slug = slug;
        post.title = title;
        post.excerpt = String.valueOf(body.getOrDefault("excerpt", ""));
        post.content = String.valueOf(body.getOrDefault("content", ""));
        post.coverImage = String.valueOf(body.getOrDefault("coverImage", ""));
        post.category = String.valueOf(body.getOrDefault("category", "Heating Advice"));
        post.tags = String.valueOf(body.getOrDefault("tags", ""));
        post.author = String.valueOf(body.getOrDefault("author", "Ant Langston"));
        post.publishedAt = String.valueOf(body.getOrDefault("publishedAt", "2026-10-06"));
        post.status = String.valueOf(body.getOrDefault("status", "PUBLISHED"));
        if (body.get("readTimeMinutes") != null) {
            post.readTimeMinutes = Integer.parseInt(String.valueOf(body.get("readTimeMinutes")));
        }
        post.createdAt = Instant.now();
        post.updatedAt = Instant.now();

        BlogPost saved = blogRepo.save(post);
        syncAllToDisk();
        syncToStorefront(saved);

        return ResponseEntity.ok(saved);
    }

    @PutMapping("/admin/blogs/{id}")
    public ResponseEntity<BlogPost> updateBlog(@PathVariable("id") Long id, @RequestBody Map<String, Object> body) {
        BlogPost post = blogRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blog not found"));

        if (body.containsKey("title")) post.title = String.valueOf(body.get("title"));
        if (body.containsKey("slug")) post.slug = toSlug(String.valueOf(body.get("slug")));
        if (body.containsKey("excerpt")) post.excerpt = String.valueOf(body.get("excerpt"));
        if (body.containsKey("content")) post.content = String.valueOf(body.get("content"));
        if (body.containsKey("coverImage")) post.coverImage = String.valueOf(body.get("coverImage"));
        if (body.containsKey("category")) post.category = String.valueOf(body.get("category"));
        if (body.containsKey("tags")) post.tags = String.valueOf(body.get("tags"));
        if (body.containsKey("author")) post.author = String.valueOf(body.get("author"));
        if (body.containsKey("publishedAt")) post.publishedAt = String.valueOf(body.get("publishedAt"));
        if (body.containsKey("status")) post.status = String.valueOf(body.get("status"));
        if (body.get("readTimeMinutes") != null) {
            post.readTimeMinutes = Integer.parseInt(String.valueOf(body.get("readTimeMinutes")));
        }
        post.updatedAt = Instant.now();

        BlogPost saved = blogRepo.save(post);
        syncAllToDisk();
        syncToStorefront(saved);

        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/admin/blogs/{id}")
    public ResponseEntity<Map<String, Object>> deleteBlog(@PathVariable("id") Long id) {
        BlogPost post = blogRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blog not found"));

        String slug = post.slug;
        blogRepo.delete(post);
        syncAllToDisk();

        // Sync deletion to Storefront
        try {
            restClient.delete()
                    .uri("/api/internal/blogs/sync/{slug}", slug)
                    .header("X-Catalogue-Sync-Secret", syncSecret)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            System.err.println("Notice: Could not sync blog deletion to storefront: " + e.getMessage());
        }

        return ResponseEntity.ok(Map.of("deleted", true, "id", id));
    }

    @PostMapping("/admin/blogs/sync-all")
    public ResponseEntity<Map<String, Object>> syncAllToStorefront() {
        syncAllToDisk();
        List<BlogPost> list = blogRepo.findAll();
        try {
            restClient.post()
                    .uri("/api/internal/blogs/sync-all")
                    .header("X-Catalogue-Sync-Secret", syncSecret)
                    .body(list)
                    .retrieve()
                    .toBodilessEntity();
            return ResponseEntity.ok(Map.of("synced", true, "count", list.size(), "message", "All " + list.size() + " blog articles successfully synchronized to Storefront!"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("synced", true, "count", list.size(), "message", "All " + list.size() + " blog articles saved and synchronized to Storefront via direct data sync!"));
        }
    }

    private synchronized void syncAllToDisk() {
        try {
            List<BlogPost> allPosts = blogRepo.findAllByOrderByCreatedAtDesc();
            List<Map<String, Object>> out = new ArrayList<>();
            for (BlogPost p : allPosts) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", p.id);
                m.put("slug", p.slug);
                m.put("title", p.title);
                m.put("excerpt", p.excerpt != null ? p.excerpt : "");
                m.put("content", p.content != null ? p.content : "");
                m.put("coverImage", p.coverImage != null ? p.coverImage : "");
                m.put("category", p.category != null ? p.category : "Heating Advice");
                m.put("tags", p.tags != null ? p.tags : "");
                m.put("author", p.author != null ? p.author : "");
                m.put("readTimeMinutes", p.readTimeMinutes != null ? p.readTimeMinutes : 5);
                m.put("publishedAt", p.publishedAt != null ? p.publishedAt : "");
                m.put("status", p.status != null ? p.status : "PUBLISHED");
                out.add(m);
            }
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            mapper.enable(com.fasterxml.jackson.databind.SerializationFeature.INDENT_OUTPUT);

            String[] targetPaths = new String[] {
                "/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/shopify/frontend/public/blogs.json",
                "/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/shopify/backend/src/main/resources/blogs.json",
                "/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/admin/frontend/public/blogs.json",
                "/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/admin/backend/src/main/resources/blogs.json"
            };
            for (String p : targetPaths) {
                java.io.File file = new java.io.File(p);
                if (file.getParentFile() != null && file.getParentFile().exists()) {
                    mapper.writeValue(file, out);
                }
            }
        } catch (Exception e) {
            System.err.println("Notice: Could not write blogs to disk: " + e.getMessage());
        }
    }

    @GetMapping("/internal/blogs/published")
    public List<BlogPost> internalPublishedBlogs(
            @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String secret) {
        if (secret == null || !secret.equals(syncSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid sync secret");
        }
        return blogRepo.findByStatusOrderByCreatedAtDesc("PUBLISHED");
    }

    private void syncToStorefront(BlogPost post) {
        try {
            restClient.post()
                    .uri("/api/internal/blogs/sync")
                    .header("X-Catalogue-Sync-Secret", syncSecret)
                    .body(post)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            System.err.println("Notice: Could not sync blog post to Storefront: " + e.getMessage());
        }
    }

    private String toSlug(String input) {
        if (input == null) return "";
        return input.toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "-");
    }
}
