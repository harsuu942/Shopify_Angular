package com.hearth.admin;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
class AdminDocumentMailService {
  private final ObjectProvider<JavaMailSender> providers;
  private final String from;
  AdminDocumentMailService(ObjectProvider<JavaMailSender> providers, @Value("${app.mail-from:}") String from){this.providers=providers;this.from=from;}

  void send(String recipient,String subject,String body){
    if(recipient==null||recipient.isBlank())throw new IllegalArgumentException("Recipient email is required");
    var sender=providers.getIfAvailable();
    if(sender==null||from==null||from.isBlank())throw new IllegalStateException("SMTP is not configured");
    var message=new SimpleMailMessage();message.setFrom(from);message.setTo(recipient.trim());message.setSubject(subject);message.setText(body);sender.send(message);
  }
}
