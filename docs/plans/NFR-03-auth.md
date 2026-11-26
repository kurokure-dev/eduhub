# NFR-03 인증 기반 구현계획

- 설계명세: `docs/design/NFR-03-auth.md` (승인됨)
- 브랜치: `feature/nfr-03-auth`
- 결정 사항: D-42~D-45
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 보안을 중심으로 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): 새 auth 도메인, 공통 설정, 기존 컨트롤러 4개의 테스트에 걸친다. 개발자 승인을 받았다

## 공통 규칙 (모든 작업)

- 명령은 `backend/`에서 실행한다. JDK 21(`JAVA_HOME=C:\Users\USER\.jdks\azul-21.0.13.0.3`)과 루트 `.env`가 필요하다. T2부터는 `.env`에 `EDUHUB_JWT_SECRET`(32바이트 이상)이 있어야 `@SpringBootTest`·`@DataJpaTest`가 뜬다. `.env`는 읽거나 고치지 않는다
- 완료 명령은 작업별 테스트와 `./gradlew spotlessApply spotlessCheck`다. 마지막에 `./gradlew spotlessCheck test` 전체를 돌린다
- 패턴은 `.claude/skills/eduhub-api/SKILL.md`와 `course` 패키지를 따른다 (record DTO, setter 금지, 생성자 주입, Lombok 없음, `@DisplayName` 한국어 + D-번호)
- 새 패키지 `com.example.eduhub.auth` 아래에 `domain`, `repository`, `service`, `controller`, `dto`, `config`, `dev`를 둔다. `auth`는 `course`·`enrollment`를 import하지 않는다. `enrollment`·`course`의 컨트롤러는 `auth.CurrentUser`만 import한다
- 설정 파일 주석에는 NFR 번호를 단다 (`# NFR-03: ...`)
- 직접 만든 Servlet 필터(`OncePerRequestFilter` 등)를 쓰지 않는다
- 커밋은 개발자가 요청할 때만 한다. 작업이 검토를 통과하면 변경을 `git add`로 스테이징해 두고, 다음 작업의 검토는 스테이징되지 않은 변경(`git diff`, `git status`의 새 파일)만 본다

## 작업 순서

```
T1 사원 스키마·엔티티 ─ T2 보안 설정·토큰 ─ T3 로그인·me API ─ T4 신청 API 교체·dev 계정 ─ T5 통합 테스트 ─ T6 API 클라이언트 재생성
```

---

## T1. 사원 스키마와 엔티티 (D-42)

| 파일 | 내용 |
|---|---|
| `src/main/resources/db/migration/V4__create_employee.sql` (신규) | 설계명세 4절 SQL 그대로 |
| `auth/domain/Role.java` (신규) | `enum Role { EMPLOYEE, ADMIN }` |
| `auth/domain/Employee.java` (신규) | `@Entity @Table(name = "employee")`. 필드 id(IDENTITY), employeeNo(`length = 20`), name(`length = 50`), passwordHash(`length = 100`), role(`@Enumerated(STRING)`, `length = 20`). 모두 `nullable = false`. `protected Employee()`, `public Employee(String employeeNo, String name, String passwordHash, Role role)`, getter만 |
| `auth/repository/EmployeeRepository.java` (신규) | `JpaRepository<Employee, Long>`, `Optional<Employee> findByEmployeeNo(String)`, `boolean existsByEmployeeNo(String)` |
| `test/.../auth/repository/EmployeeRepositoryTest.java` (신규) | `@DataJpaTest`, `@AutoConfigureTestDatabase(replace = NONE)`, `@ActiveProfiles("test")`. UUID 조각 사번으로: 저장 후 `flush`·`clear`·`findByEmployeeNo`로 확인, `existsByEmployeeNo`, 같은 사번 두 번 저장 + `flush` → `DataIntegrityViolationException` (A15) |

완료: `./gradlew test --tests "*EmployeeRepositoryTest"`

## T2. 보안 설정과 토큰 (D-42, D-43)

| 파일 | 내용 |
|---|---|
| `build.gradle.kts` | `implementation("org.springframework.boot:spring-boot-starter-security")`, `implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")`, `testImplementation("org.springframework.security:spring-security-test")`. 위에 `// NFR-03: ...` 주석 |
| `application.yml` | `eduhub.jwt.secret: ${EDUHUB_JWT_SECRET}`, `eduhub.jwt.ttl: 60m`, `eduhub.jwt.issuer: eduhub` (`# NFR-03` 주석) |
| `application-dev.yml` | `eduhub.dev-accounts.password: ${EDUHUB_DEV_PASSWORD:}` (`# NFR-03` 주석, T4에서 사용) |
| `.env.example` | `EDUHUB_JWT_SECRET=`(주석: 32바이트 이상 임의 문자열), `EDUHUB_DEV_PASSWORD=`(주석: dev 프로필 개발용 계정 비밀번호) |
| `auth/config/JwtProperties.java` (신규) | `@Validated @ConfigurationProperties("eduhub.jwt") record JwtProperties(@NotBlank String secret, @NotNull Duration ttl, @NotBlank String issuer)`. compact 생성자에서 `secret`의 UTF-8 바이트가 32 미만이면 `IllegalArgumentException` (A16). `EduhubApplication` 또는 `JwtConfig`에 `@EnableConfigurationProperties(JwtProperties.class)` |
| `auth/config/JwtConfig.java` (신규) | `SecretKey`(HmacSHA256) 생성, `JwtEncoder`(`new NimbusJwtEncoder(new ImmutableSecret<>(key))`), `JwtDecoder`(`NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build()` + `JwtValidators.createDefaultWithIssuer(issuer)`), `PasswordEncoder`(`PasswordEncoderFactories.createDelegatingPasswordEncoder()`) |
| `auth/config/SecurityConfig.java` (신규) | 설계명세 5절 그대로. 생성자로 `ObjectMapper`를 받아 `ProblemDetailAuthenticationEntryPoint`·`ProblemDetailAccessDeniedHandler`를 `new`로 만든다. `JwtAuthenticationConverter` 빈(claim `role`, prefix `ROLE_`) |
| `auth/config/ProblemDetailAuthenticationEntryPoint.java` (신규) | `AuthenticationEntryPoint`. `BearerTokenAuthenticationEntryPoint`에 먼저 위임(상태·`WWW-Authenticate`) 뒤 `ProblemDetail.forStatusAndDetail(401, "인증이 필요합니다.")`를 `application/problem+json`, UTF-8로 쓴다. 예외 메시지(토큰 내용)는 본문에 넣지 않는다 |
| `auth/config/ProblemDetailAccessDeniedHandler.java` (신규) | 같은 방식, `BearerTokenAccessDeniedHandler` 위임, 403 `"권한이 없습니다."` |
| `common/error/UnauthorizedException.java` (신규) | 401 기반 예외 (`NotFoundException`과 같은 모양) |
| `common/error/GlobalExceptionHandler.java` | `UnauthorizedException` → `ProblemDetail` 401 |
| `auth/CurrentUser.java` (신규) | 설계명세 3절. 클레임 누락·형식 오류 → `UnauthorizedException("유효하지 않은 토큰입니다.")` |
| `auth/service/TokenService.java` (신규) | `IssuedToken issue(Employee)` → 토큰 문자열과 만료 초. `JwtClaimsSet`: issuer, subject=id 문자열, `employee_no`, `role`(enum name), issuedAt=`clock.instant()`, expiresAt=+ttl. `JwsHeader.with(MacAlgorithm.HS256)` |
| `auth/service/IssuedToken.java` (신규) | `record IssuedToken(String value, long expiresInSeconds)` |
| `common/config/OpenApiConfig.java` | `components.addSecuritySchemes("bearerAuth", new SecurityScheme().type(HTTP).scheme("bearer").bearerFormat("JWT"))`, `addSecurityItem(new SecurityRequirement().addList("bearerAuth"))` |
| `course/controller/CourseController.java`, `common/health/HealthController.java` | 클래스에 `@SecurityRequirements()` (공개) |
| `course/controller/AdminCourseController.java` | 클래스 수준 `@ApiResponse` 401·403 (ProblemDetail) |
| 기존 `@WebMvcTest` 4개 | `@Import(SecurityConfig.class)`, `@MockitoBean JwtDecoder jwtDecoder`. `CourseControllerTest`·`HealthControllerTest`는 토큰 없이 그대로 통과. `AdminCourseControllerTest`의 요청마다 `.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))`, 그리고 토큰 없음 401·사원 403 테스트를 1개씩 추가. `EnrollmentControllerTest`는 요청에 `.with(jwt())`만 붙여 이 작업에서 통과시킨다 (본문 제거는 T4) |
| `test/.../auth/service/TokenServiceTest.java` (신규) | 고정 `Clock`과 실제 `JwtConfig`로 만든 encoder·decoder로 발급 → decode: sub, employee_no, role, iss, exp−iat=3600초 (A14) |
| `test/.../auth/config/JwtPropertiesTest.java` (신규) | 31바이트 secret → 예외, 32바이트 → 정상 (A16) |

완료: `./gradlew test --tests "*TokenServiceTest" --tests "*JwtPropertiesTest" --tests "*ControllerTest"`

## T3. 로그인과 현재 사용자 API (D-42)

| 파일 | 내용 |
|---|---|
| `auth/dto/LoginRequest.java` | `@NotBlank @Size(max = 20) employeeNo`, `@NotBlank @Size(max = 100) password`, `@Schema` |
| `auth/dto/UserResponse.java` | `id, employeeNo, name, role` + `static from(Employee)` |
| `auth/dto/LoginResponse.java` | `accessToken, tokenType("Bearer"), expiresIn, user` + `static of(IssuedToken, Employee)` |
| `auth/service/InvalidCredentialsException.java` | `extends UnauthorizedException`, 메시지 `"사번 또는 비밀번호가 올바르지 않습니다."` |
| `auth/service/AuthService.java` | 클래스 `@Transactional(readOnly = true)`. `LoginResponse login(String employeeNo, String password)`: 설계명세 6절. 더미 해시는 생성자에서 `passwordEncoder.encode(임의 UUID)`로 한 번 만든다. `UserResponse me(Long id)`: 없으면 `UnauthorizedException` |
| `auth/controller/AuthController.java` | `@RequestMapping("/api/auth")`, `@PostMapping("/login")`, `@Tag`, `@Operation`(D-42), `@SecurityRequirements()`, `@ApiResponse` 200·400·401 |
| `auth/controller/MeController.java` | `@GetMapping("/api/me")`, `@AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt` → `authService.me(CurrentUser.from(jwt).id())`. `@ApiResponse` 200·401 |
| `test/.../auth/service/AuthServiceTest.java` | Mockito(`EmployeeRepository`, `TokenService`, 실제 `PasswordEncoder`). 성공, 틀린 비밀번호, 없는 사번(둘 다 같은 예외·메시지), 사번 trim, me 없음 → 401 예외 |
| `test/.../auth/controller/AuthControllerTest.java` | `@WebMvcTest({AuthController.class, MeController.class})` + `@Import(SecurityConfig.class)` + `@MockitoBean JwtDecoder, AuthService`. 로그인 200 JSON, 401 problem+json, 빈 사번 400(서비스 `never()`), me 토큰 없음 401(`WWW-Authenticate` 존재), me `jwt()`(subject "7", employee_no, role) 200 |

완료: `./gradlew test --tests "*AuthServiceTest" --tests "*AuthControllerTest"`

## T4. 신청 API 교체와 개발용 계정 (D-44, D-42)

| 파일 | 내용 |
|---|---|
| `enrollment/controller/EnrollmentController.java` | `@RequestBody EnrollRequest` 제거, `@AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt` → `enrollmentService.enroll(sessionId, CurrentUser.from(jwt).employeeNo())`. `TODO(NFR-03)` 삭제. `@Operation` 설명을 D-44로 바꾸고 400 응답을 빼고 401을 추가 |
| `enrollment/dto/EnrollRequest.java` | 삭제 |
| `test/.../enrollment/controller/EnrollmentControllerTest.java` | 본문 없이 `.with(jwt().jwt(j -> j.subject("1").claim("employee_no", "E1").claim("role", "EMPLOYEE")))`로 요청. 서비스가 토큰의 사번으로 불리는지 `verify`. 본문 검증 400 테스트는 삭제하고, 토큰 없음 401(서비스 `never()`) 추가 |
| `auth/dev/DevAccountInitializer.java` (신규) | 설계명세 7절. `@Component @Profile("dev")`, `ApplicationRunner`, `EmployeeRepository`·`PasswordEncoder`·`@Value("${eduhub.dev-accounts.password:}")` 주입. 만든 사번만 INFO 로그 |

완료: `./gradlew test --tests "*EnrollmentControllerTest"`, 그리고 `grep -rn "TODO(NFR-03)" src`가 비어 있어야 한다

## T5. 통합 테스트

| 파일 | 내용 |
|---|---|
| `test/.../auth/AuthIntegrationTest.java` (신규) | `@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional`. `@BeforeEach`에서 UUID 조각 사번으로 사원·관리자(`PasswordEncoder`로 해시)와 모집 중인 과정·회차(`CourseRepository`·`CourseSessionRepository`)를 저장한다. 로그인은 실제 `/api/auth/login`으로 토큰을 얻는다. 설계명세 9절 A1~A13. 위조 토큰은 다른 32바이트 키의 `NimbusJwtEncoder`로, 만료 토큰은 실제 키로 `exp`를 과거로 서명해서 만든다 (키는 주입받은 `JwtProperties`에서) |
| `EduhubApplicationTests.java` | OpenAPI 문서에 `/api/auth/login`, `/api/me`, `components.securitySchemes.bearerAuth`가 있는지 확인을 추가 |

완료: `./gradlew spotlessApply spotlessCheck test` (전체)

## T6. 프론트 API 클라이언트 재생성 (NFR-04)

- `backend`에서 `./gradlew bootRun`(8080, dev). `frontend`에서 `npm run generate:api`. `packages/api-client`의 `openapi.json`과 `src/generated`를 함께 커밋한다
- `npx tsc --noEmit`과 신청 API를 쓰는 앱의 `npm test -w apps/<앱>`. 화면 코드가 깨지면 고치지 말고 보고한다 (화면은 이번 범위 밖)

## 위험 영역 (critical-reviewer 중점)

- 경로 매처 순서와 누락: `/api/v1/admin/**`가 `anyRequest` 전에 있고, 공개 경로가 GET으로만 열려 있는가
- 토큰 검증: HS256 고정(`alg` 바꿔치기 불가), issuer·exp 검증, 비밀키 길이 검사
- 로그인 실패 응답이 사번 존재 여부를 드러내지 않는가 (본문·시간)
- 401·403 본문에 내부 예외 메시지·토큰이 새지 않는가
- 비밀값이 코드·설정·로그·테스트에 하드코딩되지 않았는가
