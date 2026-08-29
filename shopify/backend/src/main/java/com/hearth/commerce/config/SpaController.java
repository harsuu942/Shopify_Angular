package com.hearth.commerce.config;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
@Controller
public class SpaController {
 @RequestMapping(value={"/","/{path:^(?!api|assets)[^\\.]*}","/**/{path:^(?!api|assets)[^\\.]*}"})
 public String index(){return "forward:/index.html";}
}
