package com.hearth.admin;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import java.time.LocalDate;

@Configuration @Profile("!prod")
class DataSeeder {
  @Bean CommandLineRunner seed(ProductRepository products,CustomerRepository customers,QuotationRepository quotes,CommerceOrderRepository orders,CmsContentRepository content,AuditLogRepository audits){return args->{
    if(products.count()==0){product(products,"RAD-ARLO-600","Arlo Vertical Designer Radiator","Nordhaus","Designer Radiators",62900,18,"PUBLISHED");product(products,"TWL-AVA-1200","Ava Heated Towel Rail","Vellum","Heated Towel Rails",37900,7,"PUBLISHED");product(products,"BTH-SORA-1700","Sora Freestanding Bath","Atelier","Bathrooms",109900,4,"DRAFT");product(products,"PLB-VALVE-01","Milano Thermostatic Valve Set","Forge","Plumbing",8900,42,"PUBLISHED");}
    if(customers.count()==0){customer(customers,"Maya Patel","maya@example.com","London",248900);customer(customers,"James Wilson","james@example.com","Bristol",124500);customer(customers,"Olivia Green","olivia@example.com","Manchester",79200);}
    if(quotes.count()==0){var q=new Quotation();q.quoteNumber="QT-2026-00001";q.customerName="Oak & Stone Renovations";q.customerEmail="hello@oakstone.example";q.subtotalMinor=420000;q.taxMinor=84000;q.totalMinor=504000;q.status="SENT";q.expiresOn=LocalDate.now().plusDays(7);quotes.save(q);}
    if(orders.count()==0){order(orders,"ORD-2026-00142","Maya Patel",128900,"PROCESSING","PAID","UNFULFILLED");order(orders,"ORD-2026-00141","James Wilson",62900,"READY_TO_SHIP","PAID","PACKED");order(orders,"ORD-2026-00140","Olivia Green",37900,"ON_HOLD","FAILED","UNFULFILLED");}
    if(content.count()==0){var c=new CmsContent();c.title="Summer heating edit";c.slug="summer-heating-edit";c.type="LANDING_PAGE";c.status="PUBLISHED";c.body="Curated heating designs for considered interiors.";content.save(c);}
    if(audits.count()==0){var a=new AuditLog();a.actor="system";a.action="INITIALISE";a.entityType="SYSTEM";a.entityId="admin";a.detail="Local admin workspace initialised";a.ipAddress="127.0.0.1";audits.save(a);}
  };}
  private void product(ProductRepository r,String sku,String name,String brand,String category,long price,int stock,String status){var p=new Product();p.sku=sku;p.name=name;p.brand=brand;p.category=category;p.priceMinor=price;p.costMinor=price/2;p.stock=stock;p.status=status;p.description="Premium product with technical documentation and warranty support.";r.save(p);}
  private void customer(CustomerRepository r,String name,String email,String city,long value){var c=new Customer();c.name=name;c.email=email;c.city=city;c.status="ACTIVE";c.lifetimeValueMinor=value;r.save(c);}
  private void order(CommerceOrderRepository r,String number,String customer,long total,String status,String payment,String fulfilment){var o=new CommerceOrder();o.orderNumber=number;o.customerName=customer;o.customerEmail=customer.toLowerCase().replace(" ",".")+"@example.com";o.totalMinor=total;o.orderStatus=status;o.paymentStatus=payment;o.fulfilmentStatus=fulfilment;r.save(o);}
}
