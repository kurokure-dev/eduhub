package com.example.eduhub.auth.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** JWT 설정 (NFR-03, D-42). 비밀키는 환경 변수로만 받고 UTF-8 32바이트 미만이면 기동에 실패한다. */
@Validated
@ConfigurationProperties("eduhub.jwt")
public record JwtProperties(
    @NotBlank String secret, @NotNull Duration ttl, @NotBlank String issuer) {

  private static final int MIN_SECRET_BYTES = 32;

  public JwtProperties {
    if (ttl != null && (ttl.isZero() || ttl.isNegative())) {
      throw new IllegalArgumentException("eduhub.jwt.ttl은 0보다 커야 합니다");
    }
    if (secret != null && secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
      throw new IllegalArgumentException("eduhub.jwt.secret은 UTF-8 기준 32바이트 이상이어야 합니다");
    }
  }
}
