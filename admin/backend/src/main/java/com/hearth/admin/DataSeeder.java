package com.hearth.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import java.time.LocalDate;

@Configuration @Profile("!prod")
class DataSeeder {
  @Bean CommandLineRunner seed(ProductRepository products,CustomerRepository customers,QuotationRepository quotes,CommerceOrderRepository orders,CmsContentRepository content,AuditLogRepository audits,AdminUserRepository users,PromotionRepository promotions,org.springframework.security.crypto.password.PasswordEncoder encoder,BlogPostRepository blogRepo,javax.sql.DataSource dataSource,ProductReviewRepository reviews){return args->{
    // Sanitize any existing products: remove "Ultraheat" branding permanently
    try (java.sql.Connection conn = dataSource.getConnection(); java.sql.Statement stmt = conn.createStatement()) {
      stmt.executeUpdate("UPDATE products SET name = TRIM(REPLACE(name, 'Ultraheat ', '')) WHERE name LIKE '%Ultraheat%'");
      stmt.executeUpdate("UPDATE products SET name = TRIM(REPLACE(name, 'Ultraheat', '')) WHERE name LIKE '%Ultraheat%'");
      stmt.executeUpdate("UPDATE products SET brand = 'THP Heating' WHERE brand = 'Ultraheat' OR brand LIKE '%Ultraheat%'");
      stmt.executeUpdate("UPDATE products SET description = TRIM(REPLACE(description, 'Ultraheat ', '')) WHERE description LIKE '%Ultraheat%'");
      stmt.executeUpdate("UPDATE products SET description = TRIM(REPLACE(description, 'Ultraheat', '')) WHERE description LIKE '%Ultraheat%'");
      try {
        stmt.executeUpdate("UPDATE blog_posts SET category = 'Inspiration' WHERE category = 'Lifestyle'");
      } catch (Exception ignored) {}
    } catch (Exception ignored) {}

    // Seed blogs from blogs.json if empty
    if (blogRepo.count() == 0) {
      try {
        var res = new org.springframework.core.io.ClassPathResource("blogs.json");
        if (res.exists()) {
          try (var is = res.getInputStream()) {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            java.util.List<java.util.Map<String, Object>> list = mapper.readValue(is, java.util.List.class);
            for (var map : list) {
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
          }
        }
      } catch (Exception ignored) {}
    }

    if(users.findByEmailIgnoreCase("admin@example.com").isEmpty()){var u=new AdminUser();u.name="Administrator";u.email="admin@example.com";u.passwordHash=encoder.encode("Admin123!");u.role="ADMIN";users.save(u);}
    users.findByEmailIgnoreCase("catalog@example.com").ifPresentOrElse(m -> { m.role="ADMIN"; users.save(m); }, () -> { var m=new AdminUser();m.name="Operations Admin";m.email="catalog@example.com";m.passwordHash=encoder.encode("Catalog123!");m.role="ADMIN";users.save(m); });
    java.util.List.of("RAD-ARLO-600","TWL-AVA-1200","BTH-SORA-1700","PLB-VALVE-01","RAD-WIN-600","TOW-ARC-1200","VAL-TRV-001","BTH-FRE-1700","PLB-MIX-015")
      .forEach(sku -> products.findBySku(sku).ifPresent(products::delete));
    if(customers.count()==0){customer(customers,"Maya Patel","maya@example.com","London",248900);customer(customers,"James Wilson","james@example.com","Bristol",124500);customer(customers,"Olivia Green","olivia@example.com","Manchester",79200);}
    if(quotes.count()==0){var q=new Quotation();q.quoteNumber="QT-2026-00001";q.customerName="Oak & Stone Renovations";q.customerEmail="hello@oakstone.example";q.subtotalMinor=420000;q.taxMinor=84000;q.totalMinor=504000;q.status="SENT";q.expiresOn=LocalDate.now().plusDays(7);quotes.save(q);}
    if(orders.count()==0){order(orders,"ORD-2026-00142","Maya Patel",128900,"PROCESSING","PAID","UNFULFILLED");order(orders,"ORD-2026-00141","James Wilson",62900,"READY_TO_SHIP","PAID","PACKED");order(orders,"ORD-2026-00140","Olivia Green",37900,"ON_HOLD","FAILED","UNFULFILLED");}
    if(promotions.count()==0){
      promo(promotions,"WELCOME10","10% Welcome Discount","PERCENT",10,0);
      promo(promotions,"HEAT20","£20 Heating Season Voucher","FIXED",2000,15000);
      promo(promotions,"FREESHIP","Free Express UK Delivery","FREE_SHIPPING",0,0);
      promo(promotions,"TRADE15","15% Heating Engineer Trade Discount","PERCENT",15,0);
    }
    seedCms(content, "header-announcement", "Over 14,000 Verified UK Reviews • Free UK Delivery on orders over £500", "ANNOUNCEMENT", "Over 14,000 Verified UK Reviews • Free UK Delivery on orders over £500 • 20-Year Guarantee Protection");
    seedBanner(content, "hero-luxury-heating", "Luxury Heating Built for Considered Homes.", "Modern architectural designer radiators, slimline heated towel warmers, and precision UK plumbing components.", "✦ BRITISH HEATING & LUXURY BATHROOMS · 2026", "Explore Heating Range →", "#new-arrivals", "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80", 1);
    seedBanner(content, "hero-designer-radiators", "Architectural Designer Radiators.", "Anthracite, matte black & polished chrome column radiators engineered for maximum thermal heat output.", "✦ SPECIALIST RADIATOR CURATION", "Shop Radiators →", "#new-arrivals", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80", 2);
    seedBanner(content, "hero-underfloor-heating", "Precision Water & Electric Underfloor Heating.", "Complete room packs with smart digital Wi-Fi thermostats and 25-year pipe warranty.", "✦ COMPLETE ROOM HEATING KITS", "Explore Underfloor Range →", "#new-arrivals", "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=80", 3);
    seedCampaignBanner(content, "campaign-designer-radiators", "Designer Radiators", "Architectural warmth in statement finishes with superior heat outputs.", "DESIGN-LED HEATING", "Shop Collection →", "/category/Radiators", "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80", 1);
    seedCampaignBanner(content, "campaign-underfloor-heating", "Underfloor Heating", "Efficient, responsive room climate kits for modern tile and wood floors.", "INVISIBLE COMFORT", "Explore Range →", "/category/Underfloor Heating", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80", 2);
    seedCms(content, "terms-and-conditions", "Terms & Conditions", "PAGE", """
TERMS & CONDITIONS OF SALE

1. Company Information
This website and online storefront is operated by DIGNITREE LTD, trading as The Heating and Plumbing Co. (THP).
• Company Registration Number: 16079437
• Registered Jurisdiction: England & Wales
• Registered Office: First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU
• UK VAT Registration Number: GB 480 9842 55
• Customer Care Email: sales@theheatingandplumbing.com
• WhatsApp Direct Care: +44 7404095699

2. Scope of Agreement
These Terms & Conditions apply to all sales of designer radiators, heated towel rails, electric heating, precision TRV valves, and accessories. By completing a transaction, you agree to these terms.

3. Pricing & VAT
All prices are displayed in Pounds Sterling (£ GBP) and include UK VAT at the standard statutory rate of 20% (VAT Registration: GB 480 9842 55). Secure checkout is provided via 256-Bit SSL encryption. Official VAT invoices are automatically generated and dispatched upon order completion.

4. Delivery & Specialist Pallet Logistics
• Free UK mainland delivery is provided on all orders over £500.
• In-stock products ordered before 2:00 PM on business days are dispatched on an express 48-hour tracked service.
• Large horizontal and vertical radiators are dispatched on dedicated protective pallets with tail-lift vehicles to prevent transit damage.
• Courier tracking consignment references are sent via email immediately upon dispatch.

5. Product Compliance & Manufacturer Guarantees
All heating appliances comply with British and European Standard EN442 heat output certifications. Products are backed by 10 to 20-year manufacturer guarantees against manufacturing defects and internal corrosion.

6. 30-Day Money-Back Returns Policy
In compliance with Consumer Contracts Regulations, you may return uninstalled goods in their original packaging within 30 days of delivery. Contact sales@theheatingandplumbing.com to obtain return confirmation.

7. Governing Law
These terms are governed exclusively by the laws of England and Wales.
""");
    seedCms(content, "terms-of-sale", "Terms of Sale", "PAGE", """
TERMS OF SALE & DELIVERY GUARANTEE

Operated by DIGNITREE LTD (Company number: 16079437 · VAT: GB 480 9842 55).
Registered Office: First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU.
Official Customer Contact: sales@theheatingandplumbing.com | WhatsApp: +44 7404095699

All radiators and towel rails are manufactured to EN442 standards. Orders placed before 2:00 PM are dispatched on 48h pallet express courier with live tracking. Returns accepted within 30 days of delivery in original packaging.
""");
    seedCms(content, "privacy-policy", "Privacy Policy", "PAGE", """
PRIVACY & DATA PROTECTION POLICY

1. Overview & Data Controller
DIGNITREE LTD (Company Number: 16079437, VAT: GB 480 9842 55, "we", "us", or "our") is committed to protecting your privacy in full compliance with the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.
• Data Controller: DIGNITREE LTD
• Company Registration: 16079437 (England & Wales)
• Registered Office: First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU
• VAT Registration: GB 480 9842 55
• Privacy & Customer Support Email: sales@theheatingandplumbing.com
• WhatsApp Direct Care: +44 7404095699

2. Personal Data We Collect
• Contact Information: Full name, delivery address, billing address, email, telephone number.
• Transaction History: Products ordered, sizing dimensions, order values, discount vouchers applied.
• Technical Inquiries: BTU calculations and technical questions submitted through our sizing widgets.

3. How Your Information Is Used
Your information is processed strictly to:
• Deliver and fulfill your radiator and heating orders.
• Provide courier tracking consignment updates and delivery alerts.
• Provide expert technical support and advice.
• Process manufacturer guarantee claims and warranty registrations.
We never sell, rent, or share personal data with third-party advertisers.

4. Data Security
All communications are protected by modern 256-Bit SSL/TLS encryption. Card transactions are processed directly by Level 1 PCI-DSS certified payment processors; raw payment cards are never stored on our servers.

5. Your Legal Rights
Under UK GDPR, you have the right to request access, correction, or deletion of your personal data. Contact our Data Protection Officer at sales@theheatingandplumbing.com.
""");
    seedCms(content, "faq", "Frequently Asked Questions (FAQ)", "FAQ", """
FREQUENTLY ASKED QUESTIONS (FAQ)

Q1: Who operates The Heating and Plumbing Co.?
A: The store is owned and operated by DIGNITREE LTD, registered in England & Wales (Company number: 16079437 · VAT: GB 480 9842 55). Registered office: First Floor 5-6 Chalice Close, Wallington, England, SM6 9RU. For sales, technical support, or trade inquiries, contact sales@theheatingandplumbing.com or WhatsApp +44 7404095699.

Q2: How do I calculate the required BTU heat output for my room?
A: Use our interactive Room BTU Sizing Calculator on the homepage, or submit a query to our technical team with your room length, width, and height. Our heating advisors will recommend the exact radiator sizes required.

Q3: What is included in the radiator box?
A: Every radiator and towel rail includes heavy-duty matching wall brackets, air bleed vent plugs, and blanking plugs. Radiator valves (angled, straight, or corner TRVs) are sold separately to match your floor or wall pipework layout.

Q4: How long does delivery take, and is shipping free?
A: Delivery takes 24 to 48 hours for in-stock products. All UK orders over £500 qualify for Free Express UK Delivery. Larger designer radiators are delivered on protective pallets to avoid transit damage.

Q5: What is the warranty period?
A: All our radiators carry comprehensive 10 to 20-year manufacturer guarantees against manufacturing defects and corrosion.

Q6: How do I return a product?
A: We offer a 30-day returns policy for unused, uninstalled items in original packaging. Contact sales@theheatingandplumbing.com with your order number to arrange a return.

Q7: How do I contact customer support?
A: Email sales@theheatingandplumbing.com or message us directly on WhatsApp at +44 7404095699 (Mon–Fri: 8am–8pm, Sat–Sun: 9am–5pm).
""");
    if(reviews.findAll().stream().noneMatch(r -> "Sarah Jenkins".equalsIgnoreCase(r.author))) {
      seedReview(reviews, 1L, "H2100022", "Radiators", "Sarah Jenkins", "sarah.jenkins@example.co.uk", "Harrogate, North Yorkshire", "Verified Homeowner", 5, "Stunning quality & superb warmth", "Replaced our cold ground floor radiators during a renovation. The heat output is incredible, warming our open-plan living room in minutes. Solid build quality and fast courier delivery.", "APPROVED");
      seedReview(reviews, 2L, "H2100023", "Heated Towel Rails", "Michael Thornton", "m.thornton@example.co.uk", "Cotswolds, Gloucestershire", "Verified Homeowner", 5, "Luxury bathroom centerpiece", "The finish is immaculate and feels far more premium than high street brands. Towels are always toasty, and installation was straightforward for our plumber. Highly recommended.", "APPROVED");
      seedReview(reviews, 3L, "H2100024", "Valves & Accessories", "David & Claire Edwards", "edwards.family@example.co.uk", "Cheshire, UK", "Verified Homeowner", 5, "Precision thermostatic control", "Matched these brushed brass TRVs with our column radiators. Temperature control is whisper-quiet and precise. The weighted solid brass feels like it will last decades.", "APPROVED");
      seedReview(reviews, 4L, "H2100025", "Electric Heating", "Elena Rostova", "elena.rostova@example.co.uk", "Edinburgh, Scotland", "Verified Homeowner", 5, "Energy-efficient smart warmth", "Installed this electric convector in our loft conversion where pipework wasn't possible. The built-in thermostat keeps the room exactly at 21°C without energy waste.", "APPROVED");
      seedReview(reviews, 1L, "H2100022", "Radiators", "Oliver Barnes", "oliver.barnes.plumbing@example.co.uk", "Surrey, UK", "Heating Engineer & Installer", 5, "Trade grade build & 20-year guarantee", "As a heating installer, THP products are my first recommendation to clients. True European steel gauge, no weld imperfections, and the 20-year warranty gives total peace of mind.", "APPROVED");
      seedReview(reviews, 2L, "H2100023", "Bathrooms", "Marcus Davies", "marcus.davies@example.co.uk", "Kensington, London", "Architect & Specifier", 5, "Architectural perfection", "Specified for a full residential refurbishment in London. Client is thrilled with the aesthetic balance and high thermal efficiency. Delivered palletised with zero transit damage.", "APPROVED");
    }
    if(audits.count()==0){var a=new AuditLog();a.actor="system";a.action="INITIALISE";a.entityType="SYSTEM";a.entityId="admin";a.detail="Local admin workspace initialised";a.ipAddress="127.0.0.1";audits.save(a);}
  };}
  private void seedReview(ProductReviewRepository repo, Long prodId, String sku, String cat, String author, String email, String loc, String role, int rating, String title, String comment, String status) {
    ProductReview r = new ProductReview();
    r.productId = prodId;
    r.productSku = sku;
    r.category = cat;
    r.author = author;
    r.authorEmail = email;
    r.location = loc;
    r.role = role;
    r.rating = rating;
    r.title = title;
    r.comment = comment;
    r.status = status;
    r.verifiedPurchase = true;
    r.helpfulCount = 8;
    repo.save(r);
  }
  private void seedCms(CmsContentRepository r, String slug, String title, String type, String body){
    var existing = r.findAll().stream().filter(c -> slug.equalsIgnoreCase(c.slug)).findFirst();
    var c = existing.orElseGet(CmsContent::new);
    c.slug = slug;
    c.title = title;
    c.type = type;
    c.status = "PUBLISHED";
    c.body = body.trim();
    c.publishedAt = java.time.Instant.now();
    r.save(c);
  }
  private void seedBanner(CmsContentRepository r, String slug, String title, String body, String tag, String buttonText, String linkUrl, String imageUrl, int sortOrder) {
    var existing = r.findAll().stream().filter(c -> slug.equalsIgnoreCase(c.slug)).findFirst();
    var c = existing.orElseGet(CmsContent::new);
    c.slug = slug;
    c.title = title;
    c.body = body.trim();
    c.tag = tag;
    c.buttonText = buttonText;
    c.linkUrl = linkUrl;
    c.imageUrl = imageUrl;
    c.sortOrder = sortOrder;
    c.type = "BANNER";
    c.status = "PUBLISHED";
    if (c.publishedAt == null) c.publishedAt = java.time.Instant.now();
    r.save(c);
  }
  private void seedCampaignBanner(CmsContentRepository r, String slug, String title, String body, String tag, String buttonText, String linkUrl, String imageUrl, int sortOrder) {
    var existing = r.findAll().stream().filter(c -> slug.equalsIgnoreCase(c.slug)).findFirst();
    var c = existing.orElseGet(CmsContent::new);
    c.slug = slug;
    c.title = title;
    c.body = body.trim();
    c.tag = tag;
    c.buttonText = buttonText;
    c.linkUrl = linkUrl;
    c.imageUrl = imageUrl;
    c.sortOrder = sortOrder;
    c.type = "CAMPAIGN_BANNER";
    c.status = "PUBLISHED";
    if (c.publishedAt == null) c.publishedAt = java.time.Instant.now();
    r.save(c);
  }
  private void promo(PromotionRepository r,String code,String label,String type,long val,long min){var p=new Promotion();p.code=code;p.label=label;p.discountType=type;p.discountValue=val;p.minBasketMinor=min;p.active=true;r.save(p);}
  private void product(ProductRepository r,String sku,String name,String brand,String category,long price,int stock,String status){var p=new Product();p.sku=sku;p.name=name;p.brand=brand;p.category=category;p.priceMinor=price;p.costMinor=price/2;p.stock=stock;p.status=status;p.description="Premium product with technical documentation and warranty support.";r.save(p);}
  private void customer(CustomerRepository r,String name,String email,String city,long value){var c=new Customer();c.name=name;c.email=email;c.city=city;c.status="ACTIVE";c.lifetimeValueMinor=value;r.save(c);}
  private void order(CommerceOrderRepository r,String number,String customer,long total,String status,String payment,String fulfilment){var o=new CommerceOrder();o.orderNumber=number;o.customerName=customer;o.customerEmail=customer.toLowerCase().replace(" ",".")+"@example.com";o.totalMinor=total;o.orderStatus=status;o.paymentStatus=payment;o.fulfilmentStatus=fulfilment;r.save(o);}
}
