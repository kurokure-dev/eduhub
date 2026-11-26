package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.common.error.UnauthorizedException;
import java.time.Instant;
import java.util.function.Consumer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class CurrentUserTest {

  private static Jwt jwt(Consumer<Jwt.Builder> customizer) {
    Jwt.Builder builder =
        Jwt.withTokenValue("t")
            .header("alg", "HS256")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(60));
    customizer.accept(builder);
    return builder.build();
  }

  @Test
  @DisplayName("정상 토큰은 CurrentUser로 바뀐다")
  void fromValidToken() {
    CurrentUser user =
        CurrentUser.from(
            jwt(b -> b.subject("7").claim("employee_no", "E7").claim("role", "ADMIN")));

    assertThat(user).isEqualTo(new CurrentUser(7L, "E7", Role.ADMIN));
  }

  @Test
  @DisplayName("sub가 숫자가 아니면 UnauthorizedException이다")
  void nonNumericSubject() {
    assertThatThrownBy(
            () ->
                CurrentUser.from(
                    jwt(b -> b.subject("x").claim("employee_no", "E7").claim("role", "EMPLOYEE"))))
        .isInstanceOf(UnauthorizedException.class);
  }

  @Test
  @DisplayName("employee_no가 없으면 UnauthorizedException이다")
  void missingEmployeeNo() {
    assertThatThrownBy(() -> CurrentUser.from(jwt(b -> b.subject("7").claim("role", "EMPLOYEE"))))
        .isInstanceOf(UnauthorizedException.class);
  }

  @Test
  @DisplayName("role이 잘못되면 UnauthorizedException이다")
  void invalidRole() {
    assertThatThrownBy(
            () ->
                CurrentUser.from(
                    jwt(b -> b.subject("7").claim("employee_no", "E7").claim("role", "BOSS"))))
        .isInstanceOf(UnauthorizedException.class);
  }
}
