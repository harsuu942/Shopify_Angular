package com.hearth.commerce.config;
import com.hearth.commerce.domain.Product;
import com.hearth.commerce.repo.ProductRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.*;
import java.math.BigDecimal;

@Configuration @Profile("!prod")
public class DataSeeder {
 @Bean CommandLineRunner seed(ProductRepository r){return args->{
  if(r.count()>0)return;
  r.save(new Product("RAD-WIN-600","Windsor Traditional Column Radiator","Milano","Designer Radiators","A timeless steel column radiator with excellent heat output and a durable powder-coated finish.",new BigDecimal("329.99"),24,"Anthracite","Matt",20,1180,4026,"https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=80"));
  r.save(new Product("TOW-ARC-1200","Arc Heated Towel Rail","Terma","Heated Towel Rails","Slimline towel warmer designed for modern bathrooms, with concealed brackets.",new BigDecimal("189.00"),8,"Brushed Brass","Satin",10,520,1774,"https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=900&q=80"));
  r.save(new Product("VAL-TRV-001","Thermostatic Radiator Valve Set","Hearth","Radiator Valves","Precision thermostatic control with matching lockshield valve.",new BigDecimal("44.95"),63,"Chrome","Polished",5,0,0,"https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=900&q=80"));
  r.save(new Product("BTH-FRE-1700","Luma Freestanding Bath","Crosswater","Bathrooms","A sculptural double-ended bath manufactured from stone resin.",new BigDecimal("1299.00"),5,"White","Gloss",10,0,0,"https://images.unsplash.com/photo-1564540574859-0dfb63985953?auto=format&fit=crop&w=900&q=80"));
  r.save(new Product("PLB-MIX-015","Monobloc Basin Mixer","Vado","Plumbing","Water-saving ceramic cartridge basin mixer with flexible tails.",new BigDecimal("149.50"),31,"Chrome","Polished",15,0,0,"https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80"));
 };}}
