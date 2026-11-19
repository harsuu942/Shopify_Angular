package com.hearth.commerce.api;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetMailService {
  private final ObjectProvider<JavaMailSender> mailProvider;
  private final String from;

  public PasswordResetMailService(ObjectProvider<JavaMailSender> mailProvider,
                                  @Value("${app.mail.from:}") String from) {
    this.mailProvider = mailProvider;
    this.from = from;
  }

  public boolean send(String recipient, String code) {
    JavaMailSender sender = mailProvider.getIfAvailable();
    if (sender == null || from == null || from.isBlank()) return false;
    try {
      SimpleMailMessage message = new SimpleMailMessage();
      message.setFrom(from);
      message.setTo(recipient);
      message.setSubject("Your Heating & Plumbing password reset code");
      message.setText("Your password reset code is " + code +
          ". It expires in 15 minutes. If you did not request this, ignore this email.");
      sender.send(message);
      return true;
    } catch (Exception ex) {
      return false;
    }
  }
}
