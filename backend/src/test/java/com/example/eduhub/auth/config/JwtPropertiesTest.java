package com.example.eduhub.auth.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class JwtPropertiesTest {

  /** 영문·숫자 32자(UUID에서 하이픈 제거)를 무작위로 만든다. */
  private static String randomChars(int length) {
    String raw = (UUID.randomUUID() + "" + UUID.randomUUID()).replace("-", "");
    return raw.substring(0, length);
  }

  @Test
  @DisplayName("A16 비밀키가 31바이트면 바인딩에 실패한다")
  void rejectsShortSecret() {
    assertThatThrownBy(() -> new JwtProperties(randomChars(31), Duration.ofMinutes(60), "eduhub"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("ttl이 0이면 바인딩에 실패한다")
  void rejectsZeroTtl() {
    assertThatThrownBy(() -> new JwtProperties(randomChars(32), Duration.ZERO, "eduhub"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("A16 비밀키가 32바이트면 정상이다")
  void acceptsMinimumSecret() {
    JwtProperties properties = new JwtProperties(randomChars(32), Duration.ofMinutes(60), "eduhub");

    assertThat(properties.issuer()).isEqualTo("eduhub");
  }
}
