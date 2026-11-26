# NFR-03 인증 기반 설계명세

- 관련 요구사항: NFR-03, NFR-04, NFR-05, NFR-07 / FR-03·FR-04 권한 적용
- 결정 사항: D-42 인증 방식, D-43 경로별 권한(D-30 갱신), D-44 신청자 식별(D-36 대체), D-45 본인 신청 확인(FR-06에서 적용)
- 상태: 승인됨 (2026-11-26)

## 1. 범위

하는 것
- 사번·비밀번호 로그인과 HS256 JWT 발급
- 모든 API에서 토큰으로 사용자·권한 확인 (Spring Security `oauth2-resource-server`의 기본 JWT 검증, 직접 만든 필터 없음)
- 현재 사용자 조회 `GET /api/me`
- 신청 API의 `TODO(NFR-03)` 해결: 신청자를 토큰의 사번으로 정한다
- dev 프로필에서만 개발용 계정 3개 생성

하지 않는 것
- 회원가입, 비밀번호 변경, 리프레시 토큰, FR-07·08 API, 프론트 화면
- 남의 신청 취소 404: 취소 API(FR-06)가 아직 없다. 규칙은 D-45로 남긴다

## 2. API

### POST /api/auth/login (공개)
요청
```json
{ "employeeNo": "DEV-E001", "password": "..." }
```
- `employeeNo`: `@NotBlank @Size(max = 20)`, `password`: `@NotBlank @Size(max = 100)`. 어기면 400

응답 200
```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "id": 1, "employeeNo": "DEV-E001", "name": "개발사원1", "role": "EMPLOYEE" }
}
```
오류
- 401 ProblemDetail, detail `"사번 또는 비밀번호가 올바르지 않습니다."`. 사번이 없을 때와 비밀번호가 틀릴 때 본문이 같다 (D-42)

### GET /api/me (인증 필요)
- 200 `UserResponse` (`id`, `employeeNo`, `name`, `role`). 토큰의 `sub`로 DB를 다시 조회한다
- 401: 토큰이 없거나 위조·만료됐거나, 토큰의 사원이 DB에 없을 때

### POST /api/v1/sessions/{sessionId}/enrollments (변경, 인증 필요)
- 요청 본문이 없어진다 (`EnrollRequest` 삭제). 신청자는 `CurrentUser.from(jwt).employeeNo()`다 (D-44)
- 응답과 404·409는 그대로이고 401이 추가된다. 본문 검증 400은 없어진다

### 권한 (D-43)
| 경로 | 권한 |
|---|---|
| `POST /api/auth/login` | 공개 |
| `GET /api/v1/courses/**` | 공개 |
| `GET /api/health`, `/v3/api-docs/**`, `/swagger-ui/**`, `/swagger-ui.html`, `/error` | 공개 |
| `/api/v1/admin/**` | ADMIN |
| 그 밖의 모든 요청 | 인증 필요 |

- 401·403 응답 본문은 ProblemDetail(`application/problem+json`)이다. 401에는 `WWW-Authenticate: Bearer ...` 헤더를 유지한다

## 3. 토큰 (D-42)

| 항목 | 값 |
|---|---|
| 알고리즘 | HS256 |
| 비밀키 | `eduhub.jwt.secret` = `${EDUHUB_JWT_SECRET}`. UTF-8 바이트 길이가 32보다 짧으면 기동 실패 |
| 만료 | `eduhub.jwt.ttl` = 60m. `expiresIn`은 초 단위(3600) |
| 클레임 | `iss`=`eduhub`(`eduhub.jwt.issuer`), `sub`=사원 id(문자열), `employee_no`, `role`(`EMPLOYEE`/`ADMIN`), `iat`, `exp` |
| 검증 | `NimbusJwtDecoder.withSecretKey(key).macAlgorithm(HS256)`, 기본 시각 검증(exp, nbf) + issuer 검증 + `exp` 필수(`JwtClaimValidator`, 기본 시각 검증은 exp가 없으면 건너뛰기 때문) |
| 권한 반영 | 권한과 사번은 토큰 클레임만 믿는다. 역할 변경·사원 삭제는 기존 토큰이 만료(최대 60분)된 뒤 적용된다 (D-42) |
| 권한 변환 | `JwtGrantedAuthoritiesConverter`: claim `role`, prefix `ROLE_` |
| 시각 | 발급 시각은 `ClockConfig`의 `Clock` 빈으로 잰다 (테스트 고정용) |

`CurrentUser`
```java
public record CurrentUser(Long id, String employeeNo, Role role) {
  public static CurrentUser from(Jwt jwt) { ... }
}
```
- `sub`→Long, `employee_no`, `role`→`Role.valueOf`. 클레임이 없거나 형식이 틀리면 `UnauthorizedException`(401)
- 컨트롤러는 `@AuthenticationPrincipal Jwt jwt`(`@Parameter(hidden = true)`)를 받아 `CurrentUser.from(jwt)`만 쓴다

## 4. 스키마 (V4__create_employee.sql)

```sql
-- NFR-03, D-42: 사원 계정. 회원가입은 없고 dev 프로필에서만 개발용 계정을 만든다
CREATE TABLE employee (
    id            BIGINT IDENTITY(1, 1) NOT NULL,
    employee_no   NVARCHAR(20)  NOT NULL,   -- 사번. enrollment.employee_id와 같은 값 (D-44)
    name          NVARCHAR(50)  NOT NULL,
    password_hash NVARCHAR(100) NOT NULL,   -- {bcrypt}... (DelegatingPasswordEncoder)
    role          NVARCHAR(20)  NOT NULL,
    CONSTRAINT pk_employee PRIMARY KEY (id),
    -- NFR-03: 사번 중복은 DB 유일 제약으로 막는다
    CONSTRAINT uq_employee_employee_no UNIQUE (employee_no),
    CONSTRAINT ck_employee_role CHECK (role IN ('EMPLOYEE', 'ADMIN'))
);
```
- enrollment에 FK는 걸지 않는다. 기존 개발 DB 신청 행에 employee에 없는 임의 사번이 있다 (D-44)

## 5. SecurityFilterChain

```java
http
    .csrf(csrf -> csrf.disable())                 // NFR-03: 쿠키 없이 헤더 토큰만 쓴다
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .httpBasic(b -> b.disable())
    .formLogin(f -> f.disable())
    .logout(l -> l.disable())
    .authorizeHttpRequests(auth -> auth
        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/v1/courses/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
        .requestMatchers("/error").permitAll()
        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
        .anyRequest().authenticated())
    .oauth2ResourceServer(rs -> rs
        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
        .authenticationEntryPoint(entryPoint)     // 401 ProblemDetail
        .accessDeniedHandler(deniedHandler));     // 403 ProblemDetail
```
- `JwtDecoder` 빈이 있으므로 Boot 기본 인메모리 사용자는 만들어지지 않는다
- 401·403 핸들러는 기본 `BearerTokenAuthenticationEntryPoint`·`BearerTokenAccessDeniedHandler`에 먼저 위임해 상태와 `WWW-Authenticate`를 정하고, 본문만 ProblemDetail JSON으로 쓴다. `SecurityConfig`가 `ObjectMapper`를 받아 직접 만든다 (`@WebMvcTest`에서 `@Import(SecurityConfig.class)`만으로 뜨게 하기 위해서)

## 6. 로그인 처리

- `AuthService.login(employeeNo, password)` (트랜잭션 없음. bcrypt 계산 동안 DB 커넥션을 쥐지 않게 해서, 공개 로그인 요청이 커넥션 풀을 바닥내 신청 API를 막지 않게 한다. NFR-01·NFR-03. `me()`만 `@Transactional(readOnly = true)`)
  - 사번 `trim()` 후 조회. 없으면 미리 만든 더미 해시로 `passwordEncoder.matches`를 한 번 돌린 뒤 실패 처리 (응답 시간으로 사번 존재를 알 수 없게)
  - 실패는 `InvalidCredentialsException extends UnauthorizedException` → 401
  - 성공하면 `TokenService.issue(employee)`로 토큰을 만들고 `LoginResponse`로 돌려준다
- `PasswordEncoder`는 `PasswordEncoderFactories.createDelegatingPasswordEncoder()` (bcrypt)

## 7. 개발용 계정 (dev 프로필)

- `DevAccountInitializer` (`@Profile("dev")`, `ApplicationRunner`, 트랜잭션 없음)
- `DEV-E001` 개발사원1(EMPLOYEE), `DEV-E002` 개발사원2(EMPLOYEE), `DEV-A001` 개발관리자(ADMIN). 사번이 없을 때만 만든다
- 계정마다 `saveAndFlush`(각자 트랜잭션)로 저장하고, 여러 명이 동시에 기동해 유일 제약(`uq_employee_employee_no`) 위반이 나면 건너뛴다
- 비밀번호는 `eduhub.dev-accounts.password` = `${EDUHUB_DEV_PASSWORD:}`. 비어 있거나 UTF-8 72바이트(bcrypt 한계)를 넘으면 WARN 로그만 남기고 건너뛴다. 비밀번호 값은 로그에 찍지 않는다
- 기본 프로필이 dev(`spring.profiles.default`)라서 프로필 없이 띄우면 이 계정이 생길 수 있다. 공유·운영 배포 전에 따로 정한다 (D-41로 지금은 배포하지 않음)
- test 프로필에서는 만들지 않는다

## 8. OpenAPI (NFR-04)

- `OpenApiConfig`에 `bearerAuth`(HTTP, scheme bearer, format JWT) SecurityScheme과 전역 SecurityRequirement
- 공개 API(`CourseController`, `HealthController`, `AuthController.login`)에는 `@SecurityRequirements()`로 요구를 비운다
- 보호된 API에는 401(필요하면 403) `@ApiResponse`를 단다

## 9. 테스트 시나리오

| ID | 시나리오 | 기대 |
|---|---|---|
| A1 | 올바른 사번·비밀번호로 로그인 | 200, accessToken, expiresIn=3600, user |
| A2 | 비밀번호 틀림 | 401 ProblemDetail |
| A3 | 없는 사번 | 401, A2와 같은 본문 |
| A4 | 로그인 요청 검증 실패 (빈 사번) | 400 |
| A5 | `/api/me` 토큰 없음 | 401 + `WWW-Authenticate` |
| A6 | `/api/me` 다른 키로 서명한 위조 토큰 | 401 |
| A7 | `/api/me` 만료 토큰 | 401 |
| A8 | `/api/me` 정상 토큰 | 200, 토큰의 사원 |
| A9 | 신청 토큰 없음 | 401 |
| A10 | 토큰으로 신청 (본문에 다른 사번을 넣어도) | 201, `employeeId` = 토큰의 사번 |
| A11 | `POST /api/v1/admin/courses` 토큰 없음 / 사원 / 관리자 | 401 / 403 / 201 |
| A12 | `GET /api/v1/admin/courses` 사원 | 403 ProblemDetail |
| A13 | `GET /api/v1/courses` 토큰 없음 | 200 |
| A14 | 발급 토큰 클레임 (고정 Clock) | sub, employee_no, role, iss, exp = iat + 60분 |
| A15 | 사번 중복 저장 | DB 유일 제약 위반 |
| A16 | 비밀키가 32바이트 미만 | 기동(속성 바인딩) 실패 |
| A17 | `exp` 클레임이 없는 토큰 (같은 키·issuer) | 거부 |
| A18 | 로그인 중 비밀번호 비교 시점 | 실제 트랜잭션 없음 (커넥션을 쥐지 않음) |
| A19 | dev 비밀번호가 72바이트 초과 | WARN 후 계정 생성 건너뜀 |

## 10. 위험

| 위험 | 대응 |
|---|---|
| 테스트·dev 기동에 `.env`의 `EDUHUB_JWT_SECRET`이 필요 | `.env.example`에 이름 추가, 보고 시 안내 |
| 사번 존재 여부 노출 (응답 차이·시간 차이) | 같은 401 본문, 더미 해시로 matches 수행 |
| 신청 API 본문 제거로 프론트 클라이언트 변경 | `npm run generate:api` 재생성, `tsc --noEmit` 확인 |
| 무차별 로그인 시도 | 이번 범위 밖. 개발용 로그인이며 운영 배포 전 별도 결정 필요 |
| 취소 본인 확인 미구현 | D-45, FR-06에서 구현. D-41의 배포 제한은 FR-06까지 유지 |
