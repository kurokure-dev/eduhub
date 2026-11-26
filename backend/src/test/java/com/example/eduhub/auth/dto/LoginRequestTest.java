package com.example.eduhub.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class LoginRequestTest {

  @Test
  @DisplayName("toString에 비밀번호가 나오지 않는다")
  void toStringHidesPassword() {
    String password = UUID.randomUUID().toString();

    String text = new LoginRequest("E1", password).toString();

    assertThat(text).doesNotContain(password).contains("E1");
  }
}
