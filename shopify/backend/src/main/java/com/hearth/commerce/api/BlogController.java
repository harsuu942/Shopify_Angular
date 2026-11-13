package com.hearth.commerce.api;

import com.hearth.commerce.domain.BlogPost;
import com.hearth.commerce.repo.BlogPostRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api")
public class BlogController {

    private final BlogPostRepository blogRepo;
    private final String syncSecret;

    public BlogController(BlogPostRepository blogRepo,
                          @Value("${app.catalogue-sync-secret:local-catalogue-sync-secret}") String syncSecret) {
        this.blogRepo = blogRepo;
        this.syncSecret = syncSecret;
    }

    @GetMapping("/blogs")
    public List<BlogPost> listPublishedBlogs(
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "tag", required = false) String tag,
            @RequestParam(value = "search", required = false) String search) {

        reloadFromDiskIfUpdated();

        List<BlogPost> posts;
        if (category != null && !category.isBlank() && !"all".equalsIgnoreCase(category)) {
            posts = blogRepo.findByCategoryAndStatusOrderByCreatedAtDesc(category, "PUBLISHED");
        } else {
            posts = blogRepo.findByStatusOrderByCreatedAtDesc("PUBLISHED");
        }

        if (tag != null && !tag.isBlank()) {
            String lowerTag = tag.toLowerCase();
            posts = posts.stream()
                    .filter(p -> p.tags != null && p.tags.toLowerCase().contains(lowerTag))
                    .toList();
        }

        if (search != null && !search.isBlank()) {
            String lowerSearch = search.toLowerCase();
            posts = posts.stream()
                    .filter(p -> (p.title != null && p.title.toLowerCase().contains(lowerSearch))
                            || (p.excerpt != null && p.excerpt.toLowerCase().contains(lowerSearch))
                            || (p.category != null && p.category.toLowerCase().contains(lowerSearch)))
                    .toList();
        }

        return posts;
    }

    @GetMapping("/blogs/{slugOrId}")
    public BlogPost getBlogDetail(@PathVariable("slugOrId") String slugOrId) {
        reloadFromDiskIfUpdated();
        try {
            Long id = Long.parseLong(slugOrId);
            return blogRepo.findById(id)
                    .orElseGet(() -> blogRepo.findBySlug(slugOrId)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blog post not found")));
        } catch (NumberFormatException e) {
            return blogRepo.findBySlug(slugOrId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Blog post not found"));
        }
    }

    @PostMapping("/internal/blogs/sync")
    public ResponseEntity<BlogPost> syncBlogFromAdmin(
            @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String secret,
            @RequestBody Map<String, Object> payload) {

        if (secret == null || !secret.equals(syncSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid sync secret");
        }

        String slug = String.valueOf(payload.get("slug"));
        BlogPost post = blogRepo.findBySlug(slug).orElseGet(BlogPost::new);

        post.slug = slug;
        post.title = String.valueOf(payload.get("title"));
        post.excerpt = String.valueOf(payload.getOrDefault("excerpt", ""));
        post.content = String.valueOf(payload.getOrDefault("content", ""));
        post.coverImage = String.valueOf(payload.getOrDefault("coverImage", ""));
        post.category = String.valueOf(payload.getOrDefault("category", "Heating Advice"));
        post.tags = String.valueOf(payload.getOrDefault("tags", ""));
        post.author = String.valueOf(payload.getOrDefault("author", "Ant Langston"));
        post.publishedAt = String.valueOf(payload.getOrDefault("publishedAt", ""));
        post.status = String.valueOf(payload.getOrDefault("status", "PUBLISHED"));
        if (payload.get("readTimeMinutes") != null) {
            post.readTimeMinutes = Integer.parseInt(String.valueOf(payload.get("readTimeMinutes")));
        }
        post.updatedAt = Instant.now();

        BlogPost saved = blogRepo.save(post);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/internal/blogs/sync/{slug}")
    public ResponseEntity<Map<String, Object>> deleteBlogSync(
            @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String secret,
            @PathVariable("slug") String slug) {

        if (secret == null || !secret.equals(syncSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid sync secret");
        }

        blogRepo.findBySlug(slug).ifPresent(blogRepo::delete);
        return ResponseEntity.ok(Map.of("deleted", true, "slug", slug));
    }

    @PostMapping("/internal/blogs/sync-all")
    public ResponseEntity<Map<String, Object>> syncAllBlogs(
            @RequestHeader(value = "X-Catalogue-Sync-Secret", required = false) String secret,
            @RequestBody List<Map<String, Object>> payloadList) {

        if (secret == null || !secret.equals(syncSecret)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid sync secret");
        }

        int count = 0;
        for (Map<String, Object> payload : payloadList) {
            String slug = String.valueOf(payload.get("slug"));
            BlogPost post = blogRepo.findBySlug(slug).orElseGet(BlogPost::new);
            post.slug = slug;
            post.title = String.valueOf(payload.get("title"));
            post.excerpt = String.valueOf(payload.getOrDefault("excerpt", ""));
            post.content = String.valueOf(payload.getOrDefault("content", ""));
            post.coverImage = String.valueOf(payload.getOrDefault("coverImage", ""));
            post.category = String.valueOf(payload.getOrDefault("category", "Heating Advice"));
            post.tags = String.valueOf(payload.getOrDefault("tags", ""));
            post.author = String.valueOf(payload.getOrDefault("author", "Ant Langston"));
            post.publishedAt = String.valueOf(payload.getOrDefault("publishedAt", ""));
            post.status = String.valueOf(payload.getOrDefault("status", "PUBLISHED"));
            if (payload.get("readTimeMinutes") != null) {
                post.readTimeMinutes = Integer.parseInt(String.valueOf(payload.get("readTimeMinutes")));
            }
            post.updatedAt = Instant.now();
            blogRepo.save(post);
            count++;
        }

        return ResponseEntity.ok(Map.of("syncedCount", count, "totalInStore", blogRepo.count()));
    }

    private long lastDiskSyncTime = 0;

    private synchronized void reloadFromDiskIfUpdated() {
        try {
            java.io.File f1 = new java.io.File("/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/shopify/backend/src/main/resources/blogs.json");
            java.io.File f2 = new java.io.File("/Users/harsh/Project/Mrinal-Ecommerce/Shopify_Angular/shopify/frontend/public/blogs.json");

            java.io.File chosen = null;
            long mod1 = f1.exists() ? f1.lastModified() : 0;
            long mod2 = f2.exists() ? f2.lastModified() : 0;
            long maxMod = Math.max(mod1, mod2);

            if (maxMod > lastDiskSyncTime) {
                chosen = (mod1 >= mod2 && f1.exists()) ? f1 : f2;
            }

            if (chosen != null && chosen.exists()) {
                lastDiskSyncTime = maxMod;
                ObjectMapper mapper = new JsonMapper();
                List<Map<String, Object>> list = mapper.readValue(chosen, List.class);
                java.util.Set<String> validSlugs = new java.util.HashSet<>();
                for (Map<String, Object> map : list) {
                    String slug = String.valueOf(map.get("slug"));
                    if (slug == null || slug.isBlank() || "null".equals(slug)) continue;
                    validSlugs.add(slug);
                    BlogPost post = blogRepo.findBySlug(slug).orElseGet(BlogPost::new);
                    post.slug = slug;
                    post.title = String.valueOf(map.get("title"));
                    post.excerpt = String.valueOf(map.getOrDefault("excerpt", ""));
                    post.content = String.valueOf(map.getOrDefault("content", ""));
                    post.coverImage = String.valueOf(map.getOrDefault("coverImage", ""));
                    post.category = String.valueOf(map.getOrDefault("category", "Heating Advice"));
                    post.tags = String.valueOf(map.getOrDefault("tags", ""));
                    post.author = String.valueOf(map.getOrDefault("author", ""));
                    post.publishedAt = String.valueOf(map.getOrDefault("publishedAt", ""));
                    post.status = String.valueOf(map.getOrDefault("status", "PUBLISHED"));
                    if (map.get("readTimeMinutes") != null) {
                        try {
                            post.readTimeMinutes = Integer.parseInt(String.valueOf(map.get("readTimeMinutes")));
                        } catch (Exception ignored) {}
                    }
                    post.updatedAt = Instant.now();
                    blogRepo.save(post);
                }
                for (BlogPost p : blogRepo.findAll()) {
                    if (p.slug != null && !validSlugs.contains(p.slug)) {
                        blogRepo.delete(p);
                    }
                }
            }
        } catch (Exception ignored) {}
    }
}
