package com.hearth.admin;

import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.nio.file.*;
import java.util.regex.Pattern;
import java.util.zip.ZipInputStream;

record ImportResult(int created,int updated,int variants,int skipped,List<String> warnings) {}
record ImageImportResult(int matched,int unmatched,int duplicateImages) {}

@Service
class CatalogueSyncService {
  private final RestClient client; private final String secret; private final ProductRepository products; private final AuditLogRepository audits; private final Path uploadDir;
  CatalogueSyncService(@Value("${app.shopify-api-url}") String url,@Value("${app.catalogue-sync-secret}") String secret,@Value("${app.upload-dir}") String uploadDir,ProductRepository products,AuditLogRepository audits){this.client=RestClient.builder().baseUrl(url).build();this.secret=secret;this.uploadDir=Path.of(uploadDir).toAbsolutePath().normalize();this.products=products;this.audits=audits;}
  boolean sync(Product product){
    try { syncImages(product);client.post().uri("/api/internal/catalogue/sync").contentType(MediaType.APPLICATION_JSON).header("X-Catalogue-Sync-Secret",secret).body(product).retrieve().toBodilessEntity();product.syncStatus="SYNCED";product.syncError=null;product.lastSyncedAt=java.time.Instant.now();products.save(product);audit(product,"SYNC","Catalogue and images synchronized to storefront");return true; }
    catch(Exception failure) {product.syncStatus="FAILED";product.syncError=Optional.ofNullable(failure.getMessage()).orElse("Storefront unavailable");products.save(product);audit(product,"SYNC_FAILED",product.syncError);return false;}
  }
  boolean syncOrderStatus(CommerceOrder order){
    try {
      client.post().uri("/api/internal/orders/status-update")
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Catalogue-Sync-Secret",secret)
        .body(Map.of(
          "orderNumber",Optional.ofNullable(order.orderNumber).orElse(""),
          "orderStatus",Optional.ofNullable(order.orderStatus).orElse(""),
          "paymentStatus",Optional.ofNullable(order.paymentStatus).orElse(""),
          "fulfilmentStatus",Optional.ofNullable(order.fulfilmentStatus).orElse(""),
          "carrier",Optional.ofNullable(order.carrier).orElse("DPD Express"),
          "trackingNumber",Optional.ofNullable(order.trackingNumber).orElse(""),
          "estimatedDelivery",Optional.ofNullable(order.estimatedDelivery).orElse("")
        ))
        .retrieve().toBodilessEntity();
      return true;
    } catch(Exception e){ return false; }
  }
  boolean syncPromotion(Promotion promo){
    try {
      client.post().uri("/api/internal/promotions/sync")
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Catalogue-Sync-Secret",secret)
        .body(promo)
        .retrieve().toBodilessEntity();
      return true;
    } catch(Exception e){ return false; }
  }
  boolean updateReviewStatus(Long storeReviewId, String status){
    try {
      client.post().uri("/api/internal/reviews/{id}/status", storeReviewId)
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Catalogue-Sync-Secret", secret)
        .body(Map.of("status", status))
        .retrieve().toBodilessEntity();
      return true;
    } catch(Exception e){ return false; }
  }
  boolean syncInquiryStatus(CustomerInquiry inq){
    try {
      client.post().uri("/api/internal/inquiries/status-update")
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Catalogue-Sync-Secret", secret)
        .body(Map.of(
          "ticketNumber", Optional.ofNullable(inq.ticketNumber).orElse(""),
          "id", Optional.ofNullable(inq.id).orElse(0L),
          "status", Optional.ofNullable(inq.status).orElse(""),
          "notes", Optional.ofNullable(inq.resolutionNotes).orElse("")
        ))
        .retrieve().toBodilessEntity();
      return true;
    } catch(Exception e){ return false; }
  }
  boolean syncCustomerStatus(Customer customer){
    try {
      client.post().uri("/api/internal/customers/status-update")
        .contentType(MediaType.APPLICATION_JSON)
        .header("X-Catalogue-Sync-Secret", secret)
        .body(Map.of(
          "email", Optional.ofNullable(customer.email).orElse(""),
          "status", Optional.ofNullable(customer.status).orElse("ACTIVE")
        ))
        .retrieve().toBodilessEntity();
      return true;
    } catch(Exception e){ return false; }
  }
  private void syncImages(Product product) throws Exception {
    Set<String> urls=new LinkedHashSet<>();if(product.imageUrl!=null)urls.add(product.imageUrl);for(var variant:product.variants)if(variant.imageUrl!=null)urls.add(variant.imageUrl);
    for(String url:urls){
      if(!url.startsWith("/api/product-images/"))continue;
      String filename=url.substring(url.lastIndexOf('/')+1);
      if(!filename.matches("[a-f0-9-]+\\.(jpg|png|gif|webp)"))continue;
      Path file=uploadDir.resolve(filename).normalize();
      if(!file.startsWith(uploadDir)||!Files.isRegularFile(file)){
        continue;
      }
      try {
        client.post().uri("/api/internal/catalogue/images/{filename}",filename).contentType(MediaType.APPLICATION_OCTET_STREAM).header("X-Catalogue-Sync-Secret",secret).body(Files.readAllBytes(file)).retrieve().toBodilessEntity();
      } catch(Exception ignored){}
    }
  }
  public void syncFile(String filename, byte[] bytes) {
    try {
      client.post().uri("/api/internal/catalogue/images/{filename}", filename)
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header("X-Catalogue-Sync-Secret", secret)
        .body(bytes)
        .retrieve()
        .toBodilessEntity();
    } catch(Exception ignored){}
  }
  private void audit(Product product,String action,String detail){var log=new AuditLog();log.actor="system";log.action=action;log.entityType="PRODUCT";log.entityId=String.valueOf(product.id);log.detail=detail;log.ipAddress="internal";audits.save(log);}
}

@Service
class TermaWorkbookImporter {
  private static final Map<String, List<String>> ALIASES = Map.ofEntries(
    Map.entry("sku", List.of("sku", "productsku", "termaproductcodeproductsku", "productcode", "code", "itemsku", "itemcode", "itemnumber")),
    Map.entry("name", List.of("productname", "name", "title", "producttitle", "itemname", "product")),
    Map.entry("price", List.of("sellingpriceexvat", "priceexvat", "price", "sellingprice", "unitprice", "saleprice", "rrp")),
    Map.entry("ean", List.of("eancodebarcode", "eanbarcode", "ean", "eancode", "barcode", "upc", "gtin")),
    Map.entry("category", List.of("producttype", "category", "productcategory", "type")),
    Map.entry("brand", List.of("brand", "make", "manufacturer")),
    Map.entry("cost", List.of("costprice", "cost", "buyprice", "wholesale")),
    Map.entry("stock", List.of("stockproductorleadtime", "stock", "qty", "quantity", "inventory", "availability")),
    Map.entry("description", List.of("longdescriptionnoteincall8xfsfromtherightasoneparagraphformula", "description", "longdescription", "body", "details", "desc")),
    Map.entry("shortdescription", List.of("shortdescriptiononesentence", "shortdescription", "summary")),
    Map.entry("configcode", List.of("termaconfigcode", "configcode", "configuration")),
    Map.entry("variantsku", List.of("concatenatecodeandconfigtogetherwithdashbetweenusefulforlookupsiftheseshavebeencombined", "variantsku", "variantcode")),
    Map.entry("colour", List.of("termacolour", "colour", "color", "finish")),
    Map.entry("basecolour", List.of("basicbasecolour", "basecolour", "basecolor")),
    Map.entry("colourcode", List.of("termacolourcode", "colourcode", "colorcode")),
    Map.entry("painttype", List.of("typeofpaint", "painttype", "paint")),
    Map.entry("height", List.of("heightproduct", "height", "heightmm")),
    Map.entry("width", List.of("widthproduct", "width", "widthmm")),
    Map.entry("depth", List.of("depthproductasfittedifrad", "depth", "depthmm")),
    Map.entry("panel", List.of("layersofcolumnspanels", "panel", "panels", "columns")),
    Map.entry("productiontime", List.of("productiontimetoproducetheitemattheplantinpoland", "productiontime")),
    Map.entry("leadtime", List.of("fullleadtimeinweeksforcustomerweblistingsfordeliverytoenduserallows2additionalweeksforshipmentpltoukbookinginandonwardshippingtoenduserinuk", "leadtime", "deliverytime")),
    Map.entry("watts", List.of("outputwatts756520", "watts", "wattage", "outputwatts")),
    Map.entry("btu", List.of("outputbtusdeltat50756520", "btu", "outputbtu")),
    Map.entry("warranty", List.of("lengthofguarantee", "warranty", "guarantee", "warrantyyears")),
    Map.entry("imageurl", List.of("imageurl", "image", "photo", "picture"))
  );

  private final ProductRepository products; private final CatalogueSyncService sync;
  TermaWorkbookImporter(ProductRepository products,CatalogueSyncService sync){this.products=products;this.sync=sync;}

  @org.springframework.transaction.annotation.Transactional ImportResult importWorkbook(MultipartFile file) throws Exception {
    if(file.isEmpty()) throw new IllegalArgumentException("Select an Excel workbook to upload");
    String filename=Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase();
    if(!(filename.endsWith(".xlsx")||filename.endsWith(".xlsm")||filename.endsWith(".xls"))) throw new IllegalArgumentException("Upload an .xlsx, .xlsm or .xls workbook");
    int created=0,updated=0,variantCount=0,skipped=0; var warnings=new ArrayList<String>();
    try(InputStream input=file.getInputStream(); Workbook workbook=WorkbookFactory.create(input)){
      Sheet sheet=workbook.getSheetAt(0); if(sheet.getPhysicalNumberOfRows()<2) throw new IllegalArgumentException("The workbook has no product rows");
      DataFormatter formatter=new DataFormatter(Locale.UK); FormulaEvaluator evaluator=workbook.getCreationHelper().createFormulaEvaluator();
      Map<String,Integer> columns=headers(sheet.getRow(sheet.getFirstRowNum()),formatter,evaluator);
      require(columns,"sku","name","price");
      Map<String,List<Row>> groups=new LinkedHashMap<>();
      for(int i=sheet.getFirstRowNum()+1;i<=sheet.getLastRowNum();i++){
        Row row=sheet.getRow(i); if(row==null)continue; String base=text(row,columns,"sku",formatter,evaluator);
        if(base.isBlank()){skipped++;continue;} groups.computeIfAbsent(base.trim(),x->new ArrayList<>()).add(row);
      }
      for(var entry:groups.entrySet()){
        Row first=entry.getValue().get(0); String baseSku=entry.getKey(); Product product=products.findBySku(baseSku).orElseGet(Product::new); boolean isNew=product.id==null;
        product.sku=baseSku;
        product.name=firstNonBlank(text(first,columns,"name",formatter,evaluator), baseSku);
        String b=text(first,columns,"brand",formatter,evaluator);
        product.brand=b.isBlank()?"Hearth Luxury":b;
        String cat=text(first,columns,"category",formatter,evaluator);
        product.category=cat.isBlank()?"Designer Radiators":cat;
        product.description=firstNonBlank(text(first,columns,"description",formatter,evaluator),text(first,columns,"shortdescription",formatter,evaluator));
        product.priceMinor=money(first,columns,"price",formatter,evaluator);
        product.costMinor=money(first,columns,"cost",formatter,evaluator);
        String img=text(first,columns,"imageurl",formatter,evaluator);
        if(!img.isBlank()) product.imageUrl=img;
        product.status="PUBLISHED"; product.archived=false;
        
        List<ProductVariant> incoming=new ArrayList<>();
        Set<String> seenEans=new HashSet<>();
        for(Row row:entry.getValue()){
          String rawEan=digits(text(row,columns,"ean",formatter,evaluator));
          String ean=rawEan;
          if(ean.isBlank()){
            long h=Math.abs((baseSku+"-"+row.getRowNum()).hashCode());
            ean="99"+String.format("%010d",h%10000000000L);
          }
          if(!seenEans.add(ean)){skipped++;warnings.add("Skipped row "+(row.getRowNum()+1)+": duplicate EAN "+ean);continue;}
          ProductVariant v=new ProductVariant();
          v.ean=ean;
          v.configCode=text(row,columns,"configcode",formatter,evaluator);
          String vSku=text(row,columns,"variantsku",formatter,evaluator);
          if(vSku.isBlank()){
            vSku=baseSku+(v.configCode.isBlank()?(entry.getValue().size()>1?"-V"+(row.getRowNum()+1):""):"-"+v.configCode);
          }
          v.variantSku=vSku;
          v.colour=text(row,columns,"colour",formatter,evaluator);
          v.baseColour=text(row,columns,"basecolour",formatter,evaluator);
          v.colourCode=text(row,columns,"colourcode",formatter,evaluator);
          v.paintType=text(row,columns,"painttype",formatter,evaluator);
          v.heightMm=integer(row,columns,"height",formatter,evaluator);
          v.widthMm=integer(row,columns,"width",formatter,evaluator);
          v.depthMm=integer(row,columns,"depth",formatter,evaluator);
          v.panel=text(row,columns,"panel",formatter,evaluator);
          long rowPrice=money(row,columns,"price",formatter,evaluator);
          v.priceMinor=rowPrice>0?rowPrice:product.priceMinor;
          long rowCost=money(row,columns,"cost",formatter,evaluator);
          v.costMinor=rowCost>0?rowCost:product.costMinor;

          Integer numStock=integer(row,columns,"stock",formatter,evaluator);
          if(numStock!=null&&numStock>=0){
            v.stock=numStock;
          } else {
            String avail=text(row,columns,"stock",formatter,evaluator);
            v.stock="STOCK".equalsIgnoreCase(avail)?1:0;
          }
          v.availability=text(row,columns,"stock",formatter,evaluator);
          if(v.availability.isBlank())v.availability=v.stock>0?"In Stock":"Pre-order";
          v.productionTime=text(row,columns,"productiontime",formatter,evaluator);
          v.leadTime=text(row,columns,"leadtime",formatter,evaluator);
          v.watts=integer(row,columns,"watts",formatter,evaluator);
          v.btu=integer(row,columns,"btu",formatter,evaluator);
          v.warrantyYears=years(text(row,columns,"warranty",formatter,evaluator));
          String vImg=text(row,columns,"imageurl",formatter,evaluator);
          v.imageUrl=vImg.isBlank()?product.imageUrl:vImg;
          v.product=product;
          incoming.add(v);
          variantCount++;
        }
        product.replaceVariants(incoming);

        if(product.name.isBlank()){skipped+=entry.getValue().size();warnings.add("Skipped "+baseSku+": product name is blank");continue;}
        if(!product.variants.isEmpty()){
          var primary=product.variants.get(0);
          if(primary.priceMinor!=null&&primary.priceMinor>0)product.priceMinor=primary.priceMinor;
          if(primary.costMinor!=null&&primary.costMinor>0)product.costMinor=primary.costMinor;
          product.stock=product.variants.stream().map(v->Optional.ofNullable(v.stock).orElse(0)).reduce(0,Integer::sum);
        } else {
          Integer numStock=integer(first,columns,"stock",formatter,evaluator);
          product.stock=numStock!=null&&numStock>=0?numStock:0;
        }
        Product saved=products.save(product);sync.sync(saved);if(isNew)created++;else updated++;
      }
    }
    return new ImportResult(created,updated,variantCount,skipped,warnings.stream().limit(30).toList());
  }

  byte[] generateSampleWorkbook() throws Exception {
    try(Workbook wb=new org.apache.poi.xssf.usermodel.XSSFWorkbook();
        var out=new java.io.ByteArrayOutputStream()){
      Sheet sheet=wb.createSheet("Product Catalogue");
      Row header=sheet.createRow(0);
      String[] cols={"SKU","Product Name","Brand","Category","Description","Price (Ex VAT)","Cost Price","Stock","EAN Barcode","Height (mm)","Width (mm)","Watts","BTU","Colour"};
      CellStyle headerStyle=wb.createCellStyle();
      Font font=wb.createFont();
      font.setBold(true);
      headerStyle.setFont(font);
      for(int i=0;i<cols.length;i++){
        Cell c=header.createCell(i);
        c.setCellValue(cols[i]);
        c.setCellStyle(headerStyle);
      }
      Object[][] sampleData={
        {"OXF-001","Oxford Cast Iron Designer Radiator","Hearth Luxury","Designer Radiators","Victorian aesthetic with high BTU output",795.00,380.00,15,"505699991001",600,800,1200,4095,"Anthracite"},
        {"OXF-001","Oxford Cast Iron Designer Radiator","Hearth Luxury","Designer Radiators","Victorian aesthetic with high BTU output",845.00,410.00,10,"505699991002",600,1000,1500,5118,"Brushed Brass"},
        {"CAM-002","Cambridge Brass Towel Rail","Hearth Luxury","Heated Towel Rails","Solid brushed brass with generous rung spacing",420.00,195.00,25,"505699992001",1200,500,600,2047,"Polished Chrome"},
        {"VER-003","Verona Vertical Column Radiator","Terma","Vertical Radiators","Contemporary vertical column design",550.00,260.00,12,"505699993001",1800,400,1400,4777,"Matt Black"}
      };
      for(int r=0;r<sampleData.length;r++){
        Row row=sheet.createRow(r+1);
        for(int c=0;c<sampleData[r].length;c++){
          Cell cell=row.createCell(c);
          Object val=sampleData[r][c];
          if(val instanceof Number n) cell.setCellValue(n.doubleValue());
          else cell.setCellValue(String.valueOf(val));
        }
      }
      for(int i=0;i<cols.length;i++) sheet.autoSizeColumn(i);
      wb.write(out);
      return out.toByteArray();
    }
  }

  private Map<String,Integer> headers(Row row,DataFormatter f,FormulaEvaluator e){
    var raw=new HashMap<String,Integer>();
    for(Cell c:row)raw.put(normalize(f.formatCellValue(c,e)),c.getColumnIndex());
    var canonical=new HashMap<String,Integer>();
    for(var entry:ALIASES.entrySet()){
      for(String alias:entry.getValue()){
        if(raw.containsKey(alias)){canonical.put(entry.getKey(),raw.get(alias));break;}
      }
    }
    raw.forEach(canonical::putIfAbsent);
    return canonical;
  }
  private void require(Map<String,Integer> c,String... names){var missing=Arrays.stream(names).filter(n->!c.containsKey(n)).toList();if(!missing.isEmpty())throw new IllegalArgumentException("Workbook columns are not recognised: "+String.join(", ",missing));}
  private String text(Row row,Map<String,Integer> c,String key,DataFormatter f,FormulaEvaluator e){Integer i=c.get(key);if(i==null)return "";Cell cell=row.getCell(i,Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);return cell==null?"":f.formatCellValue(cell,e).trim();}
  private long money(Row r,Map<String,Integer> c,String k,DataFormatter f,FormulaEvaluator e){String s=text(r,c,k,f,e).replace(",","").replace("£","");try{return new BigDecimal(s).multiply(BigDecimal.valueOf(100)).setScale(0,RoundingMode.HALF_UP).longValue();}catch(Exception x){return 0;}}
  private Integer integer(Row r,Map<String,Integer> c,String k,DataFormatter f,FormulaEvaluator e){String s=text(r,c,k,f,e).replace(",","");try{return new BigDecimal(s).setScale(0,RoundingMode.HALF_UP).intValue();}catch(Exception x){return null;}}
  private int years(String s){try{return Integer.parseInt(s.replaceAll("[^0-9]", ""));}catch(Exception x){return 0;}}
  private String digits(String s){return s.replaceAll("\\.0$","").replaceAll("[^0-9]","");}
  private String firstNonBlank(String a,String b){return a==null||a.isBlank()?Optional.ofNullable(b).orElse(""):a;}
  private String normalize(String s){return s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]","");}
}

@Service
class EanImageLibraryImporter {
  private static final Pattern EAN=Pattern.compile("(?i)(?:EAN[ _-]*)?(\\d{12,14})");
  private final ProductVariantRepository variants;private final ProductRepository products;private final CatalogueSyncService sync;private final Path uploadDir;
  EanImageLibraryImporter(ProductVariantRepository variants,ProductRepository products,CatalogueSyncService sync,@Value("${app.upload-dir}") String uploadDir) throws Exception {this.variants=variants;this.products=products;this.sync=sync;this.uploadDir=Path.of(uploadDir).toAbsolutePath().normalize();Files.createDirectories(this.uploadDir);}
  @org.springframework.transaction.annotation.Transactional ImageImportResult importZip(MultipartFile file) throws Exception {
    if(file.isEmpty()||!Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase().endsWith(".zip"))throw new IllegalArgumentException("Upload the Dropbox image library as a ZIP file");
    int matched=0,unmatched=0,duplicates=0;Set<String> assigned=new HashSet<>();byte[] buffer=new byte[8192];
    try(var zip=new ZipInputStream(file.getInputStream())){for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry()){
      if(entry.isDirectory())continue;String name=Path.of(entry.getName()).getFileName().toString();String lower=name.toLowerCase();if(!(lower.endsWith(".jpg")||lower.endsWith(".jpeg")||lower.endsWith(".png")||lower.endsWith(".webp")))continue;
      var matcher=EAN.matcher(name);if(!matcher.find()){unmatched++;continue;}String ean=matcher.group(1);var found=products.findByVariantsEan(ean);if(found.isEmpty()){unmatched++;continue;}if(!assigned.add(ean)){duplicates++;continue;}
      String ext=lower.substring(lower.lastIndexOf('.'));if(".jpeg".equals(ext))ext=".jpg";String stored=UUID.randomUUID()+ext;Path target=uploadDir.resolve(stored).normalize();if(!target.startsWith(uploadDir))throw new IllegalArgumentException("Invalid ZIP entry");
      try(var output=Files.newOutputStream(target,StandardOpenOption.CREATE_NEW)){int read;while((read=zip.read(buffer))>0)output.write(buffer,0,read);}var product=found.get();var variant=product.variants.stream().filter(v->ean.equals(v.ean)).findFirst().orElseThrow();variant.imageUrl="/api/product-images/"+stored;if(product.imageUrl==null||product.imageUrl.isBlank()||product.variants.get(0)==variant)product.imageUrl=variant.imageUrl;products.save(product);sync.sync(product);matched++;
    }}return new ImageImportResult(matched,unmatched,duplicates);
  }
}
