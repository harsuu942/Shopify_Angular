package com.hearth.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
class ProductImageController {
  private static final Set<String> ALLOWED_TYPES=Set.of("image/jpeg","image/png","image/gif","image/webp");
  private static final java.util.regex.Pattern EAN_PATTERN = java.util.regex.Pattern.compile("(?i)(?:EAN[ _-]*)?(\\d{12,14})");
  private final Path uploadDir;
  private final ProductRepository products;
  private final CatalogueSyncService sync;

  ProductImageController(@Value("${app.upload-dir}") String uploadDir, ProductRepository products, CatalogueSyncService sync) throws IOException {
    this.uploadDir=Path.of(uploadDir).toAbsolutePath().normalize();
    this.products=products;
    this.sync=sync;
    Files.createDirectories(this.uploadDir);
  }

  @PostMapping(value="/api/products/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  Map<String,String> upload(@RequestPart("file") MultipartFile file) throws IOException {
    if(file.isEmpty())throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Select an image to upload");
    var contentType=file.getContentType()==null?"":file.getContentType().toLowerCase();
    if(!ALLOWED_TYPES.contains(contentType))throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Only JPG, PNG, GIF and WebP images are allowed");
    var header=file.getBytes();
    if(!hasValidSignature(contentType,header))throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"The uploaded file is not a valid image");
    var extension=switch(contentType){case "image/jpeg"->".jpg";case "image/png"->".png";case "image/gif"->".gif";default->".webp";};
    var filename=UUID.randomUUID()+extension;
    var target=uploadDir.resolve(filename);
    file.transferTo(target);
    try {
      sync.syncFile(filename, header);
    } catch (Exception ignored) {}
    return Map.of("url","/api/product-images/"+filename,"filename",filename);
  }

  @GetMapping("/api/products/images")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  java.util.List<Map<String,Object>> listImages() throws IOException {
    var allProducts = products.findAll();
    try (var stream = Files.list(uploadDir)) {
      return stream.filter(Files::isRegularFile)
        .filter(p -> p.getFileName().toString().matches("[a-zA-Z0-9_.-]+\\.(jpg|png|gif|webp|svg)"))
        .sorted((a, b) -> {
          try {
            return Files.getLastModifiedTime(b).compareTo(Files.getLastModifiedTime(a));
          } catch (Exception e) {
            return 0;
          }
        })
        .map(p -> {
          String name = p.getFileName().toString();
          long size = 0;
          try { size = Files.size(p); } catch (Exception ignored) {}
          String url = "/api/product-images/" + name;
          String assignedSku = null;
          String assignedName = null;
          String category = null;
          for (var prod : allProducts) {
            if (url.equals(prod.imageUrl)) {
              assignedSku = prod.sku;
              assignedName = prod.name;
              category = prod.category;
              break;
            }
            for (var v : prod.variants) {
              if (url.equals(v.imageUrl)) {
                assignedSku = prod.sku + " (" + v.colour + ")";
                assignedName = prod.name;
                category = prod.category;
                break;
              }
            }
            if (assignedSku != null) break;
          }
          Map<String,Object> map = new java.util.HashMap<>();
          map.put("filename", name);
          map.put("url", url);
          map.put("size", size);
          map.put("assignedSku", assignedSku);
          map.put("assignedName", assignedName);
          map.put("category", category);
          return map;
        }).toList();
    }
  }

  @PostMapping(value="/api/products/images/bulk",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  java.util.List<Map<String,Object>> uploadBulk(
      @RequestPart("files") MultipartFile[] files,
      @RequestParam(defaultValue="true") boolean autoMatch) throws IOException {
    var results = new java.util.ArrayList<Map<String,Object>>();
    for (var file : files) {
      if (file.isEmpty()) continue;
      var contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
      if (!ALLOWED_TYPES.contains(contentType)) continue;
      var header = file.getBytes();
      if (!hasValidSignature(contentType, header)) continue;
      var extension = switch(contentType) {
        case "image/jpeg" -> ".jpg";
        case "image/png" -> ".png";
        case "image/gif" -> ".gif";
        default -> ".webp";
      };
      var filename = UUID.randomUUID() + extension;
      var target = uploadDir.resolve(filename);
      file.transferTo(target);
      var url = "/api/product-images/" + filename;
      var originalName = java.util.Optional.ofNullable(file.getOriginalFilename()).orElse(filename);

      String matchType = "NONE";
      String matchedDetail = null;

      if (autoMatch) {
        // 1. Match by EAN in filename
        var eanMatcher = EAN_PATTERN.matcher(originalName);
        if (eanMatcher.find()) {
          String ean = eanMatcher.group(1);
          var opt = products.findByVariantsEan(ean);
          if (opt.isPresent()) {
            var prod = opt.get();
            for (var v : prod.variants) {
              if (ean.equals(v.ean)) {
                v.imageUrl = url;
              }
            }
            if (prod.imageUrl == null || prod.imageUrl.isBlank() || prod.variants.isEmpty() || ean.equals(prod.variants.get(0).ean)) {
              prod.imageUrl = url;
            }
            products.save(prod);
            sync.sync(prod);
            matchType = "EAN";
            matchedDetail = "Variant EAN " + ean + " (" + prod.name + ")";
          }
        }

        // 2. If no EAN match, try matching by SKU
        if ("NONE".equals(matchType)) {
          var baseName = originalName.replaceAll("\\.[a-zA-Z0-9]+$", "").trim();
          var prodOpt = products.findBySku(baseName);
          if (prodOpt.isEmpty()) {
            prodOpt = products.findAll().stream()
              .filter(p -> p.sku != null && p.sku.equalsIgnoreCase(baseName))
              .findFirst();
          }
          if (prodOpt.isPresent()) {
            var prod = prodOpt.get();
            prod.imageUrl = url;
            products.save(prod);
            sync.sync(prod);
            matchType = "SKU";
            matchedDetail = "Product SKU " + prod.sku + " (" + prod.name + ")";
          }
        }
      }

      var item = new java.util.HashMap<String,Object>();
      item.put("originalName", originalName);
      item.put("url", url);
      item.put("filename", filename);
      item.put("size", file.getSize());
      item.put("matchType", matchType);
      item.put("matchedDetail", matchedDetail);
      results.add(item);
    }
    return results;
  }

  record AssignImageRequest(String imageUrl, Long productId, String variantEan) {}

  @PostMapping("/api/products/images/assign")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  Map<String,Object> assignImage(@RequestBody AssignImageRequest req) {
    if (req.productId() == null && (req.variantEan() == null || req.variantEan().isBlank())) {
      throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "ProductId or variantEan is required");
    }
    Product product = null;
    if (req.productId() != null) {
      product = products.findById(req.productId())
        .orElseThrow(() -> new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Product not found"));
      product.imageUrl = req.imageUrl();
    }
    if (req.variantEan() != null && !req.variantEan().isBlank()) {
      var opt = products.findByVariantsEan(req.variantEan().trim());
      if (opt.isPresent()) {
        product = opt.get();
        for (var v : product.variants) {
          if (req.variantEan().trim().equals(v.ean)) {
            v.imageUrl = req.imageUrl();
          }
        }
        if (product.imageUrl == null || product.imageUrl.isBlank()) {
          product.imageUrl = req.imageUrl();
        }
      }
    }
    if (product != null) {
      products.save(product);
      sync.sync(product);
      return Map.of("success", true, "productSku", product.sku, "productName", product.name);
    }
    throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Product or variant not found");
  }

  record UnassignImageRequest(String imageUrl, Long productId, String variantEan) {}

  @PostMapping("/api/products/images/unassign")
  @PreAuthorize("hasAnyRole('ADMIN','CATALOGUE_MANAGER')")
  Map<String,Object> unassignImage(@RequestBody UnassignImageRequest req) {
    if (req.imageUrl() == null || req.imageUrl().isBlank()) {
      throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "ImageUrl is required");
    }
    String url = req.imageUrl().trim();
    int unassignedCount = 0;
    List<Product> matches = products.findAll().stream()
      .filter(p -> {
        boolean matchProduct = url.equals(p.imageUrl);
        boolean matchVariant = p.variants != null && p.variants.stream().anyMatch(v -> url.equals(v.imageUrl));
        return (req.productId() == null || p.id.equals(req.productId())) && (matchProduct || matchVariant);
      })
      .toList();
    for (Product p : matches) {
      if (url.equals(p.imageUrl)) {
        p.imageUrl = null;
      }
      if (p.variants != null) {
        for (var v : p.variants) {
          if (url.equals(v.imageUrl)) {
            v.imageUrl = null;
          }
        }
      }
      products.save(p);
      sync.sync(p);
      unassignedCount++;
    }
    return Map.of("success", true, "unassignedCount", unassignedCount);
  }

  private boolean hasValidSignature(String type,byte[] b){
    if(type.equals("image/jpeg"))return b.length>2&&(b[0]&255)==0xff&&(b[1]&255)==0xd8&&(b[2]&255)==0xff;
    if(type.equals("image/png"))return b.length>7&&(b[0]&255)==0x89&&b[1]==0x50&&b[2]==0x4e&&b[3]==0x47&&b[4]==0x0d&&b[5]==0x0a&&b[6]==0x1a&&b[7]==0x0a;
    if(type.equals("image/gif"))return b.length>5&&b[0]=='G'&&b[1]=='I'&&b[2]=='F'&&b[3]=='8'&&(b[4]=='7'||b[4]=='9')&&b[5]=='a';
    return b.length>11&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P';
  }

  @GetMapping("/api/product-images/{filename}")
  ResponseEntity<Resource> image(@PathVariable("filename") String filename) throws IOException {
    if(!filename.matches("[a-zA-Z0-9_.-]+\\.(jpg|png|gif|webp|svg|pdf)"))throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    var file=uploadDir.resolve(filename).normalize();
    if(!file.startsWith(uploadDir)||!Files.isRegularFile(file))throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    var resource=new UrlResource(file.toUri());
    var type=filename.endsWith(".svg")?"image/svg+xml":(filename.endsWith(".pdf")?"application/pdf":Files.probeContentType(file));
    var resBuilder = ResponseEntity.ok().cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic()).contentType(MediaType.parseMediaType(type==null?"application/octet-stream":type));
    if(filename.endsWith(".pdf")){
      resBuilder.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"");
    }
    return resBuilder.body(resource);
  }
}
