package com.hearth.commerce.config;
import com.hearth.commerce.domain.Promotion;
import com.hearth.commerce.repo.ProductRepository;
import com.hearth.commerce.repo.PromotionRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.*;
import java.util.List;

@Configuration @Profile("!prod")
public class DataSeeder {
 @Bean CommandLineRunner seed(ProductRepository r, PromotionRepository promoRepo){return args->{
  List<String> dummySkus = List.of("RAD-WIN-600","TOW-ARC-1200","VAL-TRV-001","BTH-FRE-1700","PLB-MIX-015","RAD-ARLO-600","TWL-AVA-1200","BTH-SORA-1700","PLB-VALVE-01");
  for(String sku : dummySkus){
    r.findBySku(sku).ifPresent(r::delete);
  }
  if (promoRepo.count() == 0) {
    promoRepo.save(new Promotion("WELCOME10","10% Welcome Discount","PERCENT",10,0,true,null));
    promoRepo.save(new Promotion("HEAT20","£20 Heating Season Voucher","FIXED",2000,15000,true,null));
    promoRepo.save(new Promotion("FREESHIP","Free Express UK Delivery","FREE_SHIPPING",0,0,true,null));
    promoRepo.save(new Promotion("TRADE15","15% Heating Engineer Trade Discount","PERCENT",15,0,true,null));
  }
 };}}

