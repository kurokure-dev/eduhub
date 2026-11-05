package com.example.eduhub.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI 문서의 기본 정보. 문서화 대상 경로(/api/**)는 application.yml에서 정한다. */
@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI eduhubOpenApi() {
    return new OpenAPI()
        .info(new Info().title("EduHub API").description("사내 교육과정 조회 및 수강 신청 시스템").version("v1"));
  }
}
