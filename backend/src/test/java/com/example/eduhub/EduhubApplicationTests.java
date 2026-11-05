package com.example.eduhub;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EduhubApplicationTests {

  @Autowired private MockMvc mockMvc;

  @Test
  @DisplayName("test 프로필로 애플리케이션 컨텍스트가 뜬다")
  void contextLoads() {}

  @Test
  @DisplayName("OpenAPI 문서에 /api/health가 포함된다")
  void apiDocsIncludeHealth() throws Exception {
    mockMvc
        .perform(get("/v3/api-docs"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.info.title").value("EduHub API"))
        .andExpect(jsonPath("$.paths['/api/health']").exists());
  }
}
