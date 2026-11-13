package com.hearth.commerce.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

@RestController
public class ProductImageProxyController {
  private final Path uploadDir; private final String secret;
  ProductImageProxyController(@Value("${app.upload-dir}") String uploadDir,@Value("${app.catalogue-sync-secret}") String secret) throws Exception {this.uploadDir=Path.of(uploadDir).toAbsolutePath().normalize();this.secret=secret;Files.createDirectories(this.uploadDir);}

  @PostMapping(value="/api/internal/catalogue/images/{filename:.+}",consumes=MediaType.APPLICATION_OCTET_STREAM_VALUE)
  ResponseEntity<Void> sync(@RequestHeader("X-Catalogue-Sync-Secret") String supplied,@PathVariable("filename") String filename,@RequestBody byte[] image) throws Exception {
    if(!constantTime(secret,supplied))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    Path target=resolve(filename);if(image.length==0||image.length>10*1024*1024||!validSignature(filename,image))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid product image");
    Path temporary=Files.createTempFile(uploadDir,"sync-",".tmp");try{Files.write(temporary,image);try{Files.move(temporary,target,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException ignored){Files.move(temporary,target,StandardCopyOption.REPLACE_EXISTING);}}finally{Files.deleteIfExists(temporary);}return ResponseEntity.noContent().build();
  }

  @GetMapping("/api/product-images/{filename:.+}") ResponseEntity<Resource> image(@PathVariable("filename") String filename) throws Exception {
    Path file=resolve(filename);
    if(!Files.isRegularFile(file)){
      int dot=filename.lastIndexOf('.');
      if(dot>0){
        String base=filename.substring(0,dot);
        for(String ext:java.util.List.of(".png",".jpg",".jpeg",".webp")){
          try{Path alt=resolve(base+ext);if(Files.isRegularFile(alt)){file=alt;break;}}catch(Exception ignored){}
        }
      }
    }
    if(!Files.isRegularFile(file))throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    String type=filename.endsWith(".svg")?"image/svg+xml":(filename.endsWith(".pdf")?"application/pdf":Files.probeContentType(file));
    var resBuilder = ResponseEntity.ok().cacheControl(CacheControl.maxAge(365,TimeUnit.DAYS).cachePublic()).contentType(MediaType.parseMediaType(type==null?"application/octet-stream":type));
    if(filename.endsWith(".pdf")) resBuilder.header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"");
    return resBuilder.body(new UrlResource(file.toUri()));
  }
  private Path resolve(String filename){if(!filename.matches("[a-zA-Z0-9_.-]+\\.(jpg|png|gif|webp|svg|pdf)"))throw new ResponseStatusException(HttpStatus.NOT_FOUND);Path target=uploadDir.resolve(filename).normalize();if(!target.startsWith(uploadDir))throw new ResponseStatusException(HttpStatus.NOT_FOUND);return target;}
  private boolean validSignature(String name,byte[] b){if(name.endsWith(".pdf"))return b.length>4&&b[0]=='%'&&b[1]=='P'&&b[2]=='D'&&b[3]=='F';if(name.endsWith(".svg"))return b.length>10;if(name.endsWith(".jpg"))return b.length>2&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255;if(name.endsWith(".png"))return b.length>7&&(b[0]&255)==137&&b[1]==80&&b[2]==78&&b[3]==71&&b[4]==13&&b[5]==10&&b[6]==26&&b[7]==10;if(name.endsWith(".gif"))return b.length>5&&b[0]=='G'&&b[1]=='I'&&b[2]=='F'&&b[3]=='8'&&(b[4]=='7'||b[4]=='9')&&b[5]=='a';return b.length>11&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P';}
  private boolean constantTime(String a,String b){return a!=null&&b!=null&&java.security.MessageDigest.isEqual(a.getBytes(java.nio.charset.StandardCharsets.UTF_8),b.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
}
