# FR-04 수강 신청 구현계획

- 설계명세: `docs/design/FR-04-enroll.md` (승인됨)
- 브랜치: `feature/fr-04-enroll`
- 결정 사항: D-29, D-35~D-39
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): 이 기능은 course·enrollment 두 도메인과 마이그레이션·서비스·컨트롤러에 걸친다. 작업 단위로 나눠 각 diff를 작게 유지한다

## 공통 규칙 (모든 작업)

- 명령은 `backend/`에서 실행한다. JDK 21(`JAVA_HOME=C:\Users\USER\.jdks\azul-21.0.13.0.3`)과 루트 `.env`가 필요하다
- 완료 명령은 작업별로 적은 테스트와 `./gradlew spotlessApply spotlessCheck`다. 마지막 작업(T6)에서 `./gradlew spotlessCheck test` 전체를 돌린다
- 패턴은 `.claude/skills/eduhub-api/SKILL.md`와 `course` 패키지를 따른다 (record DTO, setter 금지, 생성자 주입, `@DisplayName` 한국어 + D-번호)
- course 패키지는 enrollment를 import하지 않는다 (D-29)
- 커밋은 작업마다 하나, Conventional Commits 형식이다 (예: `feat(backend): 회차 확정 인원과 신청 테이블 추가`)

## 작업 순서

```
T1 스키마·회차 도메인 ─┬─ T2 회차 락·관리자 경로
                       └─ T3 신청 엔티티·리포지토리 ─ T4 신청 서비스 ─ T5 신청 API ─ T6 동시성 테스트 ─ T7 API 클라이언트 재생성
```

T2와 T3은 서로 독립이지만 T4가 둘 다 필요하다. 순서대로 진행한다 (T1 → T2 → T3 → T4 → T5 → T6 → T7).

---

## T1. 마이그레이션과 회차 확정 인원 (D-37, D-38)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `src/main/resources/db/migration/V2__create_enrollment.sql` (신규) | 설계명세 4절 SQL 그대로. 각 문장 위 주석에 NFR·D 번호 |
| `course/domain/CourseSession.java` | `confirmedCount` 필드(`@Column(name = "confirmed_count", nullable = false)`, 생성자에서 0), `getConfirmedCount()`, `getRemainingSeats()`, `hasRemainingSeat()`, `isOpen()`, `occupySeat()`. `update()`에 D-38 검사 추가. 클래스·`update` Javadoc의 D-33 문구를 D-38로 갱신 |
| `course/dto/SessionResponse.java` | `remainingSeats`에 `session.getRemainingSeats()`. 주석 D-16 → D-37 |
| `course/dto/admin/AdminSessionResponse.java` | 마지막 필드로 `int confirmedCount` 추가 |

**메서드 규칙**

- `occupySeat()`: `requireOpen()` → 자리 없으면 `CourseStateException("남은 자리가 없습니다: " + id)` → `confirmedCount++`
- `update(startDate, place, capacity)`: `requireOpen()` 다음에 `if (confirmedCount > 0 && capacity != this.capacity) throw new CourseStateException("확정자가 있는 회차는 정원을 바꿀 수 없습니다: " + id)` (D-38)

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../course/domain/CourseSessionTest.java` (신규, 순수 단위) | E1 `occupySeat` 정원까지 증가, 초과 시 `CourseStateException` / E2 마감 회차 `occupySeat` 예외 / E3 확정자 있을 때 정원 변경 예외, 같은 정원으로 일정·장소만 변경 성공, 확정자 0이면 정원 변경 성공 (D-38) / E4 `getRemainingSeats` |
| `CourseControllerTest` | 기존 `remainingSeats` 기대값 20 유지 확인 (확정 0). 바꿀 필요 없으면 그대로 |
| `AdminCourseControllerTest` | 회차 응답 JSON에 `confirmedCount` 확인 한 줄 추가 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*CourseSessionTest" --tests "*CourseControllerTest" --tests "*AdminCourseControllerTest" --tests "*CourseRepositoryTest"
```

`*CourseRepositoryTest`가 V2 마이그레이션을 개발 DB에 적용하고 `ddl-auto: validate`로 스키마 일치를 확인한다.

**주의**: 마이그레이션은 공유 개발 DB에 바로 적용된다. implementer는 테스트를 돌리기 전에 V2 SQL 전문을 보고하고 멈춘다. 개발자 승인 뒤 테스트를 실행한다. 컬럼 추가와 CHECK가 한 배치에서 실패하면 문장 사이에 `GO`를 넣는다.

---

## T2. 회차 행 락과 관리자 경로 직렬화 (D-29)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `course/repository/CourseSessionRepository.java` | `findByIdForUpdate`, `findByIdAndCourseIdForUpdate`, `findByCourseIdAndStatusForUpdate` (설계명세 6절. `@Lock(PESSIMISTIC_WRITE)` + `@Query`, `@Param` 명시) |
| `course/service/CourseSessionNotFoundException.java` | `CourseSessionNotFoundException(Long sessionId)` 생성자 추가: "회차를 찾을 수 없습니다: 회차 " + id |
| `course/service/SessionLockService.java` (신규) | `@Service @Transactional(propagation = Propagation.MANDATORY)`, `CourseSession lock(Long sessionId)`. 없으면 `CourseSessionNotFoundException(sessionId)` |
| `course/service/AdminCourseService.java` | `findSession`이 `findByIdAndCourseIdForUpdate`를 쓰게 바꾼다. `close(id)`는 `findByCourseIdAndStatusForUpdate(id, OPEN)` 사용. 왜 락을 잡는지 주석(lost update, D-29) |

`findByIdAndCourseId`와 `findByCourseIdAndStatusOrderByStartDateAscIdAsc`는 다른 곳(조회)에서 쓰는지 grep으로 확인하고, 쓰지 않게 되면 지운다.

**테스트**

| 파일 | 케이스 |
|---|---|
| `AdminCourseServiceTest` | 기존 `given(...findByIdAndCourseId...)`를 `findByIdAndCourseIdForUpdate`로, 과정 종료 테스트를 `findByCourseIdAndStatusForUpdate`로 바꾼다 (A1). 확정자 있는 회차 정원 변경 → `CourseStateException` 케이스 추가 |
| `test/.../course/service/SessionLockServiceTest.java` (신규, Mockito) | 있으면 반환, 없으면 `CourseSessionNotFoundException` |
| `test/.../course/repository/CourseSessionLockRepositoryTest.java` (신규, `@DataJpaTest`) | 세 `ForUpdate` 메서드가 올바른 회차를 돌려준다. 다른 과정 id면 empty. 실행 SQL에 `updlock`이 있는지 로그(`org.hibernate.SQL: debug`)로 확인하고 결과를 보고에 적는다 (R7) |

`SessionLockService`의 `MANDATORY`는 트랜잭션 없이 부르면 `IllegalTransactionStateException`이 나는지 `@SpringBootTest` 없이 확인하기 어렵다. T6 동시성 테스트에서 실제 경로로 검증한다.

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*AdminCourseServiceTest" --tests "*SessionLockServiceTest" --tests "*CourseSessionLockRepositoryTest" --tests "*AdminCourseControllerTest"
```

---

## T3. 신청 엔티티와 리포지토리 (FR-04, D-07, D-39)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/domain/EnrollmentStatus.java` (신규) | `CONFIRMED`, `WAITING`, `CANCELLED`, `COMPLETED`, 각 Javadoc |
| `enrollment/domain/Enrollment.java` (신규) | 설계명세 5절. 정적 팩터리 `confirmed(session, employeeId, appliedAt)`, `waiting(session, employeeId, appliedAt)`. 게터 `getId`, `getSession`, `getEmployeeId`, `getStatus`, `getWaitingOrder`, `getAppliedAt`. `waitingOrder`는 FR-04에서 항상 null (주석 D-39) |
| `enrollment/repository/EnrollmentRepository.java` (신규) | `existsBySessionIdAndEmployeeIdAndStatusIn`, `existsBySessionIdAndStatus` |
| `common/config/ClockConfig.java` (신규) | `@Bean Clock clock() { return Clock.systemDefaultZone(); }` |

**테스트**

`test/.../enrollment/repository/EnrollmentRepositoryTest.java` (신규, `@DataJpaTest` + `replace = NONE` + `@ActiveProfiles("test")`). `@BeforeEach`에서 고유 분류(`"T-" + UUID 8자`)의 과정과 회차를 저장하고, 사번도 고유 접두사로 만든다.

| # | 케이스 |
|---|---|
| R1 | 같은 회차·사번으로 WAITING 두 번 `saveAndFlush` → `DataIntegrityViolationException` (`ux_enrollment_active`) |
| R2 | CANCELLED 행이 있는 사번이 다시 CONFIRMED로 저장 성공 (D-07). CANCELLED 행은 테스트에서 `JdbcTemplate`이나 네이티브 INSERT로 만든다 (취소 메서드는 FR-06) |
| R3 | 같은 회차에 서로 다른 사번 WAITING 두 행, 둘 다 `waiting_order` NULL로 저장 성공 |
| R4 | CONFIRMED 행의 `waiting_order`에 값을 넣는 네이티브 UPDATE → 예외 (`ck_enrollment_waiting_order`) |
| R5 | 정원 2 회차의 `confirmed_count`를 3으로 네이티브 UPDATE → 예외 (`ck_course_session_confirmed_count`) |
| R6 | `existsBySessionIdAndEmployeeIdAndStatusIn`, `existsBySessionIdAndStatus` 참·거짓 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*EnrollmentRepositoryTest"
```

---

## T4. 신청 서비스 (FR-04, NFR-01, D-35)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/service/EnrollmentService.java` (신규) | `@Service @Transactional`, 생성자 주입(`SessionLockService`, `EnrollmentRepository`, `Clock`). `EnrollmentResponse enroll(Long sessionId, String employeeId)`: 설계명세 7절 1~7단계 그대로 |
| `enrollment/service/SessionClosedException.java` (신규) | `extends ConflictException`, "마감된 회차에는 신청할 수 없습니다: " + sessionId |
| `enrollment/service/DuplicateEnrollmentException.java` (신규) | `extends ConflictException`, "이미 신청한 회차입니다: 회차 " + sessionId |
| `enrollment/dto/EnrollmentResponse.java` (신규) | `record(Long id, Long sessionId, String employeeId, EnrollmentStatus status, LocalDateTime appliedAt)`, `static from(Enrollment)`. `sessionId`는 `enrollment.getSession().getId()` (LAZY 프록시의 id 접근은 초기화하지 않는다) |

`DataIntegrityViolationException`을 잡을 때는 `saveAndFlush` 한 줄만 try로 감싼다. 다른 제약 위반까지 중복으로 오인하지 않도록, 메시지에 `ux_enrollment_active`가 있을 때만 `DuplicateEnrollmentException`으로 바꾸고 그 밖에는 다시 던진다.

**테스트**

`test/.../enrollment/service/EnrollmentServiceTest.java` (신규, `@ExtendWith(MockitoExtension.class)`). `CourseSession`은 실제 객체를 만들고 `ReflectionTestUtils`로 id를 넣는다. `Clock.fixed(...)` 사용.

설계명세 8절 S1~S9를 모두 만든다. S4·S5는 `verify(enrollmentRepository, never()).saveAndFlush(any())`, S1은 `session.getConfirmedCount() == 1`, S2·S3은 `confirmedCount` 변화 없음을 확인한다. S7에는 `ux_enrollment_active`가 아닌 위반이면 원래 예외가 그대로 나가는 케이스를 더한다.

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*EnrollmentServiceTest"
```

---

## T5. 신청 API (FR-04, NFR-04, D-36)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/dto/EnrollRequest.java` (신규) | `record(@Schema(description = "사번", example = "E2024001") @NotBlank @Size(max = 20) String employeeId)` |
| `enrollment/controller/EnrollmentController.java` (신규) | `@RestController @RequestMapping("/api/v1/sessions/{sessionId}/enrollments") @Tag(name = "수강 신청")`. `@PostMapping @ResponseStatus(CREATED) EnrollmentResponse enroll(@PathVariable Long sessionId, @Valid @RequestBody EnrollRequest request)`. 본문에 `// TODO(NFR-03): 인증 도입 시 현재 로그인 사용자 사번으로 교체한다 (D-36)`. `@Operation` description에 D-35·D-36·D-07, `@ApiResponse` 201·400·404·409(ProblemDetail) |

**테스트**

`test/.../enrollment/controller/EnrollmentControllerTest.java` (신규, `@WebMvcTest(EnrollmentController.class)` + `@MockitoBean EnrollmentService`). 설계명세 8절 C1~C4. C1에서 `jsonPath("$.waitingNumber").doesNotExist()`, C2에서 `verify(service).enroll(3L, " E1 ")`, C4에서 `SessionClosedException`·`DuplicateEnrollmentException`·`CourseSessionNotFoundException`을 각각 던지게 하고 상태와 `content-type: application/problem+json` 확인.

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*EnrollmentControllerTest"
```

---

## T6. 동시성 테스트 (NFR-01)

**변경 파일**

`test/.../enrollment/EnrollmentConcurrencyTest.java` (신규, `@SpringBootTest`, `@ActiveProfiles("test")`, 클래스에 `@Transactional` 없음)

**준비**

- `TransactionTemplate`으로 고유 제목의 과정, 정원 10 회차를 저장하고 `enrollmentService.enroll`을 9번 호출해 확정 9명을 만든다 (커밋됨)
- `ExecutorService`(고정 스레드 100)와 `CountDownLatch`(준비 1, 완료 100)

**케이스**

| # | 케이스 | 확인 |
|---|---|---|
| N1 | 100스레드가 서로 다른 사번으로 동시에 `enroll` | 예외 0, CONFIRMED 행 10, `confirmed_count` 10, WAITING 99(모두 `waiting_order` NULL), 응답 중 CONFIRMED 정확히 1 |
| N2 | 정원 50 회차에 같은 사번으로 20스레드 동시 `enroll` | 성공 1, `DuplicateEnrollmentException` 19, 해당 사번의 행 1개 |
| N3 | 정원 60·확정 9 회차에 신청 50건과 관리자 `updateSession`(정원 60 그대로, 장소만 변경) 5건을 같은 래치로 섞어 동시 실행 | 예외 0, `confirmed_count` == CONFIRMED 행 수 == 59 (lost update 없음), 정원 60 유지, 장소가 변경 후 값 중 하나 |

- 결과는 `JdbcTemplate`으로 DB에서 직접 센다 (영속성 컨텍스트 캐시 배제)
- 실행 시간을 `System.out`이 아니라 로거로 남긴다
- `@AfterEach`: 만든 회차의 `enrollment` → `course_session` → `course` 순으로 `JdbcTemplate` DELETE. 테스트가 실패해도 지우도록 `@AfterEach`에서 한다
- `ExecutorService`는 `try-finally`로 `shutdown` + `awaitTermination(30초)`. 시간 초과면 테스트 실패

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*EnrollmentConcurrencyTest"
./gradlew spotlessCheck test
```

두 번째 명령(전체 테스트) 통과가 백엔드 완료 조건이다.

---

## T7. 프론트 API 클라이언트 재생성 (NFR-04)

신청 API가 추가되고 `AdminSessionResponse`에 `confirmedCount`가 생겼으므로 스펙에서 클라이언트를 다시 만든다. 화면은 바꾸지 않는다 (신청 버튼 D-27은 범위 밖).

1. `cd backend && ./gradlew bootRun` (포트 8080, 백그라운드)
2. `cd frontend && npm run generate:api`
3. `packages/api-client`의 `openapi.json`, `src/generated` 변경 확인 (손으로 고치지 않는다)
4. `npm test -w apps/admin-mfe`, `npx tsc --noEmit` (`AdminSessionResponse`를 쓰는 앱). course-mfe가 `SessionResponse`를 쓰면 같은 검사를 돌린다
5. bootRun 종료

**완료 명령**

```bash
cd frontend && npm test -w apps/admin-mfe && npx tsc --noEmit
```

---

## 위험 영역 (reviewer·critical-reviewer 확인 항목)

| 위험 | 확인할 곳 |
|---|---|
| 회차를 바꾸는 경로 중 락 없이 조회하는 곳이 남음 → `confirmed_count` lost update | T2: `CourseSession`을 바꾸는 모든 서비스 메서드 grep, T6 N3 |
| `PESSIMISTIC_WRITE`가 SQL Server에서 `updlock` 힌트로 나가지 않음 | T2 SQL 로그, T6 N1 |
| `SessionLockService`가 트랜잭션 밖에서 불려 락이 바로 풀림 | `MANDATORY` 설정, `EnrollmentService` 클래스 `@Transactional` |
| `DataIntegrityViolationException` 변환이 다른 제약 위반을 숨김 | T4 제약 이름 검사와 S7 추가 케이스 |
| course가 enrollment를 import | 모든 작업 diff에서 `import com.example.eduhub.enrollment`가 course 패키지에 없는지 |
| V2가 공유 개발 DB에 적용됨, 실패 시 되돌리기 어려움 | T1 실행 전 개발자 승인. 실패하면 V2를 고치지 말고 원인 보고 (이미 일부 적용됐을 수 있음) |
| 동시성 테스트 데이터가 개발 DB에 남음 | T6 `@AfterEach` 정리, 실패 후 남은 행 확인 |
| 신청자 본인 확인 없음 (NFR-03) | Controller `TODO(NFR-03)` 존재 확인. PR 본문에 명시 |
