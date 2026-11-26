package com.example.eduhub.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.web.AuthenticationEntryPoint;

/** 401 응답을 ProblemDetail로 쓴다 (NFR-03). 상태와 WWW-Authenticate는 기본 Bearer 진입점이 정한다. */
public class ProblemDetailAuthenticationEntryPoint implements AuthenticationEntryPoint {

  private final BearerTokenAuthenticationEntryPoint delegate =
      new BearerTokenAuthenticationEntryPoint();
  private final ObjectMapper objectMapper;

  public ProblemDetailAuthenticationEntryPoint(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Override
  public void commence(
      HttpServletRequest request, HttpServletResponse response, AuthenticationException e)
      throws IOException {
    delegate.commence(request, response, e);
    // 예외 메시지(토큰 내용)는 본문에 넣지 않는다
    ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "인증이 필요합니다.");
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
    objectMapper.writeValue(response.getOutputStream(), body);
  }
}
