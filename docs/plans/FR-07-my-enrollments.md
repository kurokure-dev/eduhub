# FR-07 내 신청 내역 조회 구현계획

- 설계명세: `docs/design/FR-07-my-enrollments.md`
- 브랜치: `feature/fr-07-my-enrollments`
- 결정 사항: D-09, D-39, D-44, D-46
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): 이 작업은 마이그레이션·엔티티·리포지토리·서비스·컨트롤러에 걸친다. 작업 단위로 나눠 diff를 작게 유지한다

## 공통 규칙 (모든 작업)

- 명령은 `backend/`에서 실행한다. JDK 21(`JAVA_HOME=C:\Users\USER\.jdks\azul-21.0.13.0.3`)과 루트 `.env`가 필요하다
- 완료 명령은 작업별로 적은 테스트와 `./gradlew spotlessApply spotlessCheck`다. T3에서는 `./gradlew spotlessCheck test` 전체를 돌린다
- 패턴은 `.claude/skills/eduhub-api/SKILL.md`와 기존 enrollment·course 패키지를 따른다 (record DTO, setter 금지, 생성자 주입, `@DisplayName`은 한국어 + D-번호)
- 커밋은 작업마다 하나, Conventional Commits 형식이다. 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 대기 키 부여·V5 ─ T2 조회 쿼리·서비스 ─ T3 조회 API ─ T4 API 클라이언트 재생성
```

---

## T1. V5 마이그레이션과 대기 키 부여 (D-39, D-46)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `src/main/resources/db/migration/V5__waiting_order_and_my_enrollment_index.sql` (신규) | 설계명세 6절 SQL 그대로 |
| `enrollment/domain/Enrollment.java` | `waiting(session, employeeId, appliedAt, long waitingOrder)`가 키를 받는다. Javadoc의 "FR-04에서는 항상 null"을 D-46으로 고친다 |
| `enrollment/repository/EnrollmentRepository.java` | `@Query("select max(e.waitingOrder) from Enrollment e where e.session.id = :sessionId") Optional<Long> findMaxWaitingOrder(@Param("sessionId") Long sessionId)` |
| `enrollment/service/EnrollmentService.java` | 대기 분기: `long key = enrollmentRepository.findMaxWaitingOrder(sessionId).orElse(0L) + 1;` 다음 `Enrollment.waiting(session, trimmed, now, key)`. 락 뒤에서만 호출한다(기존 주석 유지) |

**테스트**

| 파일 | 케이스 |
|---|---|
| `EnrollmentServiceTest` | 대기 분기에서 최대값이 없으면 키 1, 5면 키 6 (저장 인자를 `ArgumentCaptor`로 확인). 확정 분기는 키가 null이다 |
| `EnrollmentRepositoryTest` | R3 변경(키 1·2 저장 성공, 같은 키는 `ux_enrollment_waiting_order` 위반), 키 없는 대기 행은 `ck_enrollment_waiting_order` 위반, `findMaxWaitingOrder`가 회차별 최대값과 빈 값을 돌려준다. 기존 `Enrollment.waiting(...)` 호출에는 서로 다른 키를 넣는다 |
| `EnrollmentConcurrencyTest` | 마지막 단언을 "대기 99행의 키가 1~99로 중복 없음"으로 바꾼다 (기본 제외 테스트) |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*EnrollmentServiceTest" --tests "*EnrollmentRepositoryTest" --tests "*EnrollmentControllerTest"
./gradlew concurrencyTest   # D-40: 공유 개발 DB에 커밋하는 테스트. 개발자 승인 뒤 한 번 실행
```

**주의**: V5는 공유 개발 DB에 바로 적용된다. implementer는 테스트를 돌리기 전에 V5 SQL 전문을 보고하고 멈춘다. 개발자가 승인한 뒤에 테스트를 실행한다.

---

## T2. 내 신청 조회 쿼리와 서비스 (FR-07, D-09)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/dto/MyEnrollmentResponse.java` (신규) | 설계명세 3절 record. 필드마다 `@Schema(description = ...)`, `waitingRank`는 `nullable = true`. JPQL 생성자 표현식이 쓰므로 정식 생성자의 인자 순서는 설계명세 4절과 같다 |
| `enrollment/repository/EnrollmentRepository.java` | 설계명세 4절의 `findMine` |
| `enrollment/service/MyEnrollmentQueryService.java` (신규) | `@Service @Transactional(readOnly = true)`, `List<MyEnrollmentResponse> findMine(String employeeNo, @Nullable EnrollmentStatus status)` |
| `src/test/resources/application-test.yml` | `spring.jpa.properties.hibernate.generate_statistics: true`, `logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener: WARN`. 주석에 `# NFR-02: FR-07 쿼리 개수 확인용` |

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../enrollment/service/MyEnrollmentQueryServiceTest.java` (신규, `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")` + `@Import(MyEnrollmentQueryService.class)`) | 설계명세 7절 M1~M8. 데이터는 고유 사번(UUID 조각)과 `Enrollment.confirmed`·`waiting`(키 직접 지정)으로 만든다. 상태 변경은 네이티브 SQL(같은 트랜잭션)로 한다. M7은 `flush`·`clear` 뒤 `Statistics.clear()`, 조회, `getPrepareStatementCount()`를 1과 비교한다 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*MyEnrollmentQueryServiceTest" --tests "*EnrollmentRepositoryTest"
```

실제 SQL 한 줄을 보고에 붙인다 (`show-sql` 또는 `org.hibernate.SQL` DEBUG를 잠깐 켜서 확인하고, 설정은 되돌린다).

---

## T3. 내 신청 조회 API (FR-07, NFR-03)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/controller/MyEnrollmentController.java` (신규) | `@Tag(name = "Enrollment")`, `@RequestMapping("/api/me/enrollments")`, `@GetMapping`. 인자는 `@Parameter(description = "상태 (없으면 전체)") @RequestParam(required = false) EnrollmentStatus status`, `@AuthenticationPrincipal @Parameter(hidden = true) Jwt jwt`. 본문은 `service.findMine(CurrentUser.from(jwt).employeeNo(), status)`. `@Operation`(D-09, D-44를 설명에 적는다), `@ApiResponse` 200/400/401(400·401은 ProblemDetail 스키마) |

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../enrollment/controller/MyEnrollmentControllerTest.java` (신규) | 설계명세 7절 C1~C4. `EnrollmentControllerTest`의 보안 설정 패턴(`@Import(SecurityConfig.class)`, `@MockitoBean JwtDecoder`, `jwt().jwt(j -> j.claim("employee_no", ...))`)을 따른다 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test
```

---

## T4. 프론트 API 클라이언트 재생성 (NFR-04)

- `backend`에서 bootRun(dev)을 띄운 뒤 `frontend`에서 `npm run generate:api`를 실행한다. 생성물은 `packages/api-client/openapi.json`, `src/generated/api.ts`
- 화면 코드는 바꾸지 않는다. `npx tsc --noEmit`(admin-mfe, course-mfe)과 두 앱의 테스트를 돌린다
- bootRun 상태에서 curl로 확인한다: DEV-E001 로그인 → `GET /api/me/enrollments` 200, `?status=WAITING` 200, 토큰 없이 401, `?status=FOO` 400
