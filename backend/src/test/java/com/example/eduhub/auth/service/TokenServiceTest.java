package com.example.eduhub.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.auth.config.JwtConfig;
import com.example.eduhub.auth.config.JwtProperties;
import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.util.ReflectionTestUtils;

class TokenServiceTest {

  // 디코더는 실제 시각으로 exp를 검증하므로 고정 시각을 현재 시각(초 단위)으로 잡는다
  private static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.SECONDS);
  private static final Duration TTL = Duration.ofMinutes(60);

  /** 키는 테스트 안에서 무작위로 만든다 (UUID 두 개, 72자). */
  private static String randomSecret() {
    return UUID.randomUUID() + "" + UUID.randomUUID();
  }

  private static Employee employee() {
    Employee employee = new Employee("E-" + UUID.randomUUID(), "홍길동", "{noop}x", Role.ADMIN);
    ReflectionTestUtils.setField(employee, "id", 7L);
    return employee;
  }

  private static TokenService tokenService(JwtProperties properties, Instant now) {
    return new TokenService(
        new JwtConfig().jwtEncoder(properties), properties, Clock.fixed(now, ZoneOffset.UTC));
  }

  private static List<String> descriptions(Throwable e) {
    return ((JwtValidationException) e)
        .getErrors().stream().map(OAuth2Error::getDescription).toList();
  }

  private static JwtDecoder decoder(JwtProperties properties) {
    return new JwtConfig().jwtDecoder(properties);
  }

  @Test
  @DisplayName("A14 발급한 토큰의 클레임은 sub, employee_no, role, iss이고 exp는 iat + 60분이다")
  void issuedTokenClaims() {
    JwtProperties properties = new JwtProperties(randomSecret(), TTL, "eduhub");
    Employee employee = employee();

    IssuedToken issued = tokenService(properties, NOW).issue(employee);
    Jwt jwt = decoder(properties).decode(issued.value());

    assertThat(issued.expiresInSeconds()).isEqualTo(3600);
    assertThat(jwt.getSubject()).isEqualTo("7");
    assertThat(jwt.getClaimAsString("employee_no")).isEqualTo(employee.getEmployeeNo());
    assertThat(jwt.getClaimAsString("role")).isEqualTo("ADMIN");
    assertThat(jwt.getClaimAsString("iss")).isEqualTo("eduhub");
    assertThat(jwt.getIssuedAt()).isEqualTo(NOW);
    assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt()))
        .isEqualTo(Duration.ofSeconds(3600));
  }

  @Test
  @DisplayName("issuer가 다른 토큰은 decode에서 거부된다")
  void rejectsOtherIssuer() {
    String secret = randomSecret();
    String token =
        tokenService(new JwtProperties(secret, TTL, "other-issuer"), NOW).issue(employee()).value();

    assertThatThrownBy(() -> decoder(new JwtProperties(secret, TTL, "eduhub")).decode(token))
        .isInstanceOf(JwtValidationException.class)
        .hasMessageContaining("The iss claim is not valid")
        .satisfies(e -> assertThat(descriptions(e)).anyMatch(d -> d.contains("iss")));
  }

  @Test
  @DisplayName("만료된 토큰은 decode에서 거부된다")
  void rejectsExpiredToken() {
    JwtProperties properties = new JwtProperties(randomSecret(), TTL, "eduhub");
    String token =
        tokenService(properties, NOW.minus(Duration.ofHours(2))).issue(employee()).value();

    assertThatThrownBy(() -> decoder(properties).decode(token))
        .isInstanceOf(JwtValidationException.class)
        .hasMessageContaining("Jwt expired")
        .satisfies(e -> assertThat(descriptions(e)).anyMatch(d -> d.contains("expired")));
  }

  @Test
  @DisplayName("NFR-03 exp가 없는 토큰은 같은 키·issuer라도 decode에서 거부된다")
  void rejectsTokenWithoutExp() {
    String secret = randomSecret();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("eduhub")
            .subject("7")
            .claim("employee_no", "E1")
            .claim("role", "ADMIN")
            .issuedAt(NOW)
            .build();
    String token =
        new JwtConfig()
            .jwtEncoder(new JwtProperties(secret, TTL, "eduhub"))
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();

    assertThatThrownBy(() -> decoder(new JwtProperties(secret, TTL, "eduhub")).decode(token))
        .isInstanceOf(JwtValidationException.class)
        .hasMessageContaining("The exp claim is not valid");
  }

  @Test
  @DisplayName("다른 비밀키로 서명한 토큰은 decode에서 거부된다")
  void rejectsOtherKey() {
    String token =
        tokenService(new JwtProperties(randomSecret(), TTL, "eduhub"), NOW)
            .issue(employee())
            .value();

    assertThatThrownBy(
            () -> decoder(new JwtProperties(randomSecret(), TTL, "eduhub")).decode(token))
        .isInstanceOf(BadJwtException.class)
        .hasMessageContaining("Invalid signature");
  }

  @Test
  @DisplayName("같은 키라도 HS384로 서명한 토큰은 decode에서 거부된다")
  void rejectsHs384() {
    String secret = randomSecret();
    NimbusJwtEncoder hs384Encoder =
        new NimbusJwtEncoder(
            new ImmutableSecret<>(
                new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA384")));
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer("eduhub")
            .subject("7")
            .claim("employee_no", "E1")
            .claim("role", "ADMIN")
            .issuedAt(NOW)
            .expiresAt(NOW.plus(TTL))
            .build();
    String token =
        hs384Encoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS384).build(), claims))
            .getTokenValue();

    assertThatThrownBy(() -> decoder(new JwtProperties(secret, TTL, "eduhub")).decode(token))
        .isInstanceOf(BadJwtException.class)
        .hasMessageContaining("Another algorithm expected, or no matching key(s) found");
  }
}
