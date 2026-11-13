package com.hearth.commerce.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="blog_posts", indexes={
    @Index(name="idx_blog_slug", columnList="slug"),
    @Index(name="idx_blog_status", columnList="status")
})
public class BlogPost {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(unique=true, nullable=false)
    public String slug;

    @Column(nullable=false, length=500)
    public String title;

    @Column(length=2000)
    public String excerpt;

    @Column(length=32000)
    public String content;

    public String coverImage;
    public String category = "Heating Advice";
    public String tags = "Heating Advice";
    public String author = "Ant Langston";
    public Integer readTimeMinutes = 5;
    public String publishedAt = "2026-10-06";
    public String status = "PUBLISHED";

    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();

    public BlogPost() {}
}
