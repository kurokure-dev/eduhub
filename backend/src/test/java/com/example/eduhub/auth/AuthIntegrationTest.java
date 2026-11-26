package com.example.eduhub.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.eduhub.auth.config.JwtProperties;
import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.repository.EmployeeRepository;
import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.repository.CourseRepository;
import com.example.eduhub.course.repository.CourseSessionRepository;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

/** 실제 보안 설정·JwtDecoder·개발 DB로 인증 시나리오 A1~A13을 확인한다 (NFR-03). 테스트는 롤백된다. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthIntegrationTest {

  private static final String LOGIN_FAIL_DETAIL = "사번 또는 비밀번호가 올바르지 않습니다.";

  @Autowired private MockMvc mockMvc;
  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private PasswordEncoder passwordEncoder;
  @Autowired private JwtProperties jwtProperties;

  private String employeeNo;
  private String adminNo;
  private String password;
  private Employee employee;
  private Long sessionId;

  @BeforeEach
  void setUp() {
    password = UUID.randomUUID().toString();
    employeeNo = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 18);
    adminNo = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 18);
    String hash = passwordEncoder.encode(password);
    employee = employeeRepository.save(new Employee(employeeNo, "테스트사원", hash, Role.EMPLOYEE));
    employeeRepository.save(new Employee(adminNo, "테스트관리자", hash, Role.ADMIN));
    Course course = courseRepository.save(new Course("인증 테스트 과정", "테스트", null));
    sessionId =
        sessionRepository
            .save(new CourseSession(course, LocalDate.now().plusDays(30), "테스트실", 5))
            .getId();
  }

  private String login(String no, String pw) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody(no, pw)))
            .andExpect(status().isOk())
            .andReturn();
    String body = result.getResponse().getContentAsString();
    return com.jayway.jsonpath.JsonPath.read(body, "$.accessToken");
  }

  private static String loginBody(String no, String pw) {
    return "{\"employeeNo\":\"" + no + "\",\"password\":\"" + pw + "\"}";
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private String forgedToken() {
    byte[] key = new byte[32];
    new SecureRandom().nextBytes(key);
    NimbusJwtEncoder encoder =
        new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(key, "HmacSHA256")));
    return sign(
        encoder, Instant.now().minus(1, ChronoUnit.MINUTES), Instant.now().plusSeconds(600));
  }

  private String expiredToken() {
    NimbusJwtEncoder encoder =
        new NimbusJwtEncoder(
            new ImmutableSecret<>(
                new SecretKeySpec(
                    jwtProperties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
    Instant now = Instant.now();
    return sign(encoder, now.minus(2, ChronoUnit.HOURS), now.minus(1, ChronoUnit.HOURS));
  }

  private String sign(NimbusJwtEncoder encoder, Instant issuedAt, Instant expiresAt) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(jwtProperties.issuer())
            .subject(String.valueOf(employee.getId()))
            .claim("employee_no", employeeNo)
            .claim("role", "EMPLOYEE")
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .build();
    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  private final String adminCourseTitle = "관리자 등록 과정 " + UUID.randomUUID();

  private String courseBody() {
    return "{\"title\":\"" + adminCourseTitle + "\",\"category\":\"테스트\",\"description\":\"설명\"}";
  }

  private long adminCourseCount() {
    return courseRepository.findAll().stream()
        .filter(c -> adminCourseTitle.equals(c.getTitle()))
        .count();
  }

  private String validTokenWithRealKey() {
    NimbusJwtEncoder encoder =
        new NimbusJwtEncoder(
            new ImmutableSecret<>(
                new SecretKeySpec(
                    jwtProperties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
    Instant now = Instant.now();
    return sign(encoder, now.minus(1, ChronoUnit.MINUTES), now.plus(10, ChronoUnit.MINUTES));
  }

  @Test
  @DisplayName("A1 올바른 사번·비밀번호로 로그인하면 토큰과 사용자 정보를 받는다")
  void a1LoginSuccess() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody(employeeNo, password)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").isNotEmpty())
        .andExpect(jsonPath("$.tokenType").value("Bearer"))
        .andExpect(jsonPath("$.expiresIn").value(3600))
        .andExpect(jsonPath("$.user.employeeNo").value(employeeNo))
        .andExpect(jsonPath("$.user.role").value("EMPLOYEE"));
  }

  @Test
  @DisplayName("A2·A3 비밀번호가 틀려도 없는 사번이어도 같은 401 본문이다")
  void a2a3LoginFailureSameBody() throws Exception {
    String wrongPassword =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(loginBody(employeeNo, UUID.randomUUID().toString())))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.detail").value(LOGIN_FAIL_DETAIL))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    String unknownNo =
        mockMvc
            .perform(
                post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        loginBody("X" + UUID.randomUUID().toString().substring(0, 18), password)))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.detail").value(LOGIN_FAIL_DETAIL))
            .andReturn()
            .getResponse()
            .getContentAsString(StandardCharsets.UTF_8);
    assertThat(unknownNo).isEqualTo(wrongPassword);
  }

  @Test
  @DisplayName("A4 빈 사번으로 로그인하면 400이다")
  void a4BlankEmployeeNo() throws Exception {
    mockMvc
        .perform(
            post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(loginBody("", password)))
        .andExpect(status().isBadRequest());
  }

  @Test
  @DisplayName("A5 /api/me에 토큰이 없으면 401과 WWW-Authenticate 헤더")
  void a5MeWithoutToken() throws Exception {
    mockMvc
        .perform(get("/api/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  @DisplayName("대조 sign()으로 실제 키·미만료 토큰을 만들면 /api/me가 200이다")
  void controlTokenWithRealKeyIsAccepted() throws Exception {
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(validTokenWithRealKey())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.employeeNo").value(employeeNo));
  }

  @Test
  @DisplayName("A6 다른 키로 서명한 위조 토큰은 401이다")
  void a6ForgedToken() throws Exception {
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(forgedToken())))
        .andExpect(status().isUnauthorized())
        .andExpect(
            header()
                .string(HttpHeaders.WWW_AUTHENTICATE, containsString("error=\"invalid_token\"")))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  @DisplayName("A7 만료된 토큰은 401이다")
  void a7ExpiredToken() throws Exception {
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(expiredToken())))
        .andExpect(status().isUnauthorized())
        .andExpect(
            header()
                .string(HttpHeaders.WWW_AUTHENTICATE, containsString("error=\"invalid_token\"")))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  @DisplayName("A8 정상 토큰이면 /api/me가 토큰의 사원을 돌려준다")
  void a8MeWithValidToken() throws Exception {
    String token = login(employeeNo, password);
    mockMvc
        .perform(get("/api/me").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(employee.getId()))
        .andExpect(jsonPath("$.employeeNo").value(employeeNo))
        .andExpect(jsonPath("$.name").value("테스트사원"))
        .andExpect(jsonPath("$.role").value("EMPLOYEE"));
  }

  @Test
  @DisplayName("A9 토큰 없이 신청하면 401이다")
  void a9EnrollWithoutToken() throws Exception {
    mockMvc
        .perform(post("/api/v1/sessions/{id}/enrollments", sessionId))
        .andExpect(status().isUnauthorized())
        .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, startsWith("Bearer")))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  @DisplayName("A10 토큰으로 신청하면 201이고 본문의 다른 사번은 무시된다")
  void a10EnrollWithToken() throws Exception {
    String token = login(employeeNo, password);
    mockMvc
        .perform(
            post("/api/v1/sessions/{id}/enrollments", sessionId)
                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"employeeId\":\"OTHER-999\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.employeeId").value(employeeNo))
        .andExpect(jsonPath("$.status").value("CONFIRMED"));
  }

  @Test
  @DisplayName("A11 관리자 과정 등록은 토큰 없음 401, 사원 403, 관리자 201")
  void a11AdminCourseCreate() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/courses")
                .contentType(MediaType.APPLICATION_JSON)
                .content(courseBody()))
        .andExpect(status().isUnauthorized());
    assertThat(adminCourseCount()).isZero();

    String employeeToken = login(employeeNo, password);
    mockMvc
        .perform(
            post("/api/v1/admin/courses")
                .header(HttpHeaders.AUTHORIZATION, bearer(employeeToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(courseBody()))
        .andExpect(status().isForbidden());
    assertThat(adminCourseCount()).isZero();

    String adminToken = login(adminNo, password);
    mockMvc
        .perform(
            post("/api/v1/admin/courses")
                .header(HttpHeaders.AUTHORIZATION, bearer(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(courseBody()))
        .andExpect(status().isCreated());
    assertThat(adminCourseCount()).isEqualTo(1);
  }

  @Test
  @DisplayName("A12 사원이 관리자 목록을 조회하면 403 ProblemDetail이다")
  void a12EmployeeAdminList() throws Exception {
    String token = login(employeeNo, password);
    mockMvc
        .perform(get("/api/v1/admin/courses").header(HttpHeaders.AUTHORIZATION, bearer(token)))
        .andExpect(status().isForbidden())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(403));
  }

  @Test
  @DisplayName("A13 과정 목록은 토큰 없이도 200이다")
  void a13PublicCourseList() throws Exception {
    mockMvc.perform(get("/api/v1/courses")).andExpect(status().isOk());
  }
}
