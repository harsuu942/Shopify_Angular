package com.hearth.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
class ProductImageController {
  private static final Set<String> ALLOWED_TYPES=Set.of("image/jpeg","image/png","image/gif","image/webp");
  private final Path uploadDir;

  ProductImageController(@Value("${app.upload-dir}") String uploadDir) throws IOException {
    this.uploadDir=Path.of(uploadDir).toAbsolutePath().normalize();
    Files.createDirectories(this.uploadDir);
  }

  @PostMapping(value="/api/products/images",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
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
    return Map.of("url","/api/product-images/"+filename,"filename",filename);
  }

  private boolean hasValidSignature(String type,byte[] b){
    if(type.equals("image/jpeg"))return b.length>2&&(b[0]&255)==0xff&&(b[1]&255)==0xd8&&(b[2]&255)==0xff;
    if(type.equals("image/png"))return b.length>7&&(b[0]&255)==0x89&&b[1]==0x50&&b[2]==0x4e&&b[3]==0x47&&b[4]==0x0d&&b[5]==0x0a&&b[6]==0x1a&&b[7]==0x0a;
    if(type.equals("image/gif"))return b.length>5&&b[0]=='G'&&b[1]=='I'&&b[2]=='F'&&b[3]=='8'&&(b[4]=='7'||b[4]=='9')&&b[5]=='a';
    return b.length>11&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P';
  }

  @GetMapping("/api/product-images/{filename}")
  ResponseEntity<Resource> image(@PathVariable String filename) throws IOException {
    if(!filename.matches("[a-f0-9-]+\\.(jpg|png|gif|webp)"))throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    var file=uploadDir.resolve(filename).normalize();
    if(!file.startsWith(uploadDir)||!Files.isRegularFile(file))throw new ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
    var resource=new UrlResource(file.toUri());
    var type=Files.probeContentType(file);
    return ResponseEntity.ok().cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic()).contentType(MediaType.parseMediaType(type==null?"application/octet-stream":type)).body(resource);
  }
}
