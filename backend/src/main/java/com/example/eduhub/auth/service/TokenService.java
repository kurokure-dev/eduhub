package com.example.eduhub.auth.service;

import com.example.eduhub.auth.config.JwtProperties;
import com.example.eduhub.auth.domain.Employee;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** 사원에게 HS256 액세스 토큰을 발급한다 (NFR-03, D-42). */
@Service
public class TokenService {

  private final JwtEncoder jwtEncoder;
  private final JwtProperties properties;
  private final Clock clock;

  public TokenService(JwtEncoder jwtEncoder, JwtProperties properties, Clock clock) {
    this.jwtEncoder = jwtEncoder;
    this.properties = properties;
    this.clock = clock;
  }

  public IssuedToken issue(Employee employee) {
    Instant now = clock.instant();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(properties.issuer())
            .subject(String.valueOf(employee.getId()))
            .claim("employee_no", employee.getEmployeeNo())
            .claim("role", employee.getRole().name())
            .issuedAt(now)
            .expiresAt(now.plus(properties.ttl()))
            .build();
    String token =
        jwtEncoder
            .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    return new IssuedToken(token, properties.ttl().toSeconds());
  }
}
