# FR-04 수강 신청 설계명세

- 브랜치: `feature/fr-04-enroll`
- 관련 요구사항: FR-04, NFR-01, NFR-03, NFR-04, NFR-05, NFR-07 (FR-05는 WAITING 저장 자리만 남김)
- 관련 결정: D-04, D-07, D-08, D-16, D-29, D-31, D-33, 이번에 추가한 D-35~D-39
- 상태: 승인됨, 구현 완료 (T1~T6). 개발 DB 전용, NFR-03·FR-06 전 배포 금지 (D-41)

## 1. 범위

| 포함 | 제외 (다음 기능) |
|---|---|
| 회차 신청 API (FR-04) | 대기 순번 부여·응답, `waiting_order` 값 채우기 (FR-05) |
| 같은 회차 중복 신청 차단 (FR-04, D-07) | 신청 취소·자동 승급 (FR-06) |
| 동시 신청 시 정원 초과 금지 (NFR-01) | 내 신청 내역 조회 (FR-07) |
| 정원이 차면 WAITING으로 저장 (순번 없음, D-35) | 정원 변경에 따른 승급·강등 (D-05, D-06) |
| 회차 확정 인원 `confirmed_count`, 과정 상세 남은 자리 반영 (D-37) | 마감 시 대기 자동 취소 (D-04) |
| 관리자 회차 변경·마감을 회차 행 락으로 직렬화 | 프론트 신청 버튼 (D-27, `frontend/apps`에 아직 앱 없음) |
| 확정자가 있는 회차의 정원 변경 임시 차단 (D-38) | 알림 기록 (FR-09) |

## 2. 결정 사항 (`docs/requirements.md`에 추가)

| ID | 주제 | 결정 |
|---|---|---|
| D-35 | FR-04 범위 | FR-04는 신청 API와 동시성 처리까지 만든다. 남은 자리가 있고 대기자가 없으면 확정, 그렇지 않으면 대기(WAITING)로 저장한다. 대기 순번 부여·응답(FR-05)과 취소·승급(FR-06)은 다음 기능에서 만든다 |
| D-36 | 신청자 식별 | 인증 방식(NFR-03)이 정해지기 전까지 신청자는 요청 본문의 `employeeId`(사번, 최대 20자)로 받는다. 본인 확인은 하지 않는다. 인증을 도입할 때 현재 로그인 사용자로 바꾼다. 서비스는 사번을 인자로 받고, Controller에 `TODO(NFR-03)`를 남긴다 |
| D-37 | 확정 인원 | 회차(`course_session`)에 확정 인원 `confirmed_count`를 두고 회차 행 락 안에서만 바꾼다. 과정 상세의 남은 자리는 `capacity - confirmed_count`다 (D-16 대체) |
| D-38 | 임시 제한 | 확정자가 있는 회차는 정원을 바꿀 수 없다(409, 일정·장소는 바꿀 수 있다). 마감 시 대기 자동 취소(D-04)와 승급·강등(D-05, D-06)은 FR-06에서 붙이며, 그때 이 제한을 푼다 (D-33 갱신) |
| D-39 | 대기 정렬 키 | 대기 순서는 신청 시각이 아니라 `waiting_order`(회차 안에서 유일한 정수)로 정한다. 새 대기는 회차의 현재 최대값 + 1(없으면 1), 강등자는 최소값 - 1로 앞에 넣는다. 대기 순번은 같은 회차의 대기 중 자신 이하 키의 개수다. 키 부여는 FR-05에서 한다. 그 전에 저장된 대기 신청은 FR-05 마이그레이션이 `applied_at, id` 순으로 채운다 |
| D-40 | 동시성 테스트 | 동시성 테스트는 D-15의 예외로 개발 DB에 커밋하고 끝나면 지운다. `@Tag("concurrency")`로 기본 `./gradlew test`에서 빼고 `./gradlew concurrencyTest`로 직접 실행한다 |
| D-41 | 배포 제한 | 인증(NFR-03)과 취소(FR-06) 전까지 신청 기능은 개발 DB에서만 쓰고 공유·운영 환경에 배포하지 않는다 |

## 3. API

### `POST /api/v1/sessions/{sessionId}/enrollments`

회차에 수강 신청한다. `EnrollmentController`(`enrollment/controller`), `@Tag(name = "수강 신청")`.

요청 본문 `EnrollRequest`:

```json
{ "employeeId": "E2024001" }
```

| 필드 | 타입 | 검증 |
|---|---|---|
| employeeId | string | `@NotBlank`, `@Size(max = 20)`. 서비스에서 `trim()` |

Controller는 본문의 값을 서비스 인자로 넘긴다:

```java
// TODO(NFR-03): 인증 도입 시 현재 로그인 사용자 사번으로 교체한다 (D-36)
return enrollmentService.enroll(sessionId, request.employeeId());
```

응답 `201 Created`, `EnrollmentResponse`:

```json
{
  "id": 15,
  "sessionId": 3,
  "employeeId": "E2024001",
  "status": "WAITING",
  "appliedAt": "2026-11-12T10:15:30.123456"
}
```

- `status`는 `CONFIRMED` 또는 `WAITING` (이 API는 두 값만 돌려준다)
- 대기 순번(`waitingNumber`)은 FR-05에서 응답에 추가한다

오류 (모두 ProblemDetail, `application/problem+json`):

| 상태 | 조건 | 예외 |
|---|---|---|
| 400 | `employeeId` 누락·공백·20자 초과 | Bean Validation |
| 404 | 회차 없음 | `CourseSessionNotFoundException` (course 패키지, 회차 id만 받는 생성자 추가) |
| 409 | 마감된 회차 (D-04) | `SessionClosedException extends ConflictException` (enrollment) |
| 409 | 같은 회차에 확정·대기 신청이 이미 있음 (FR-04, D-07) | `DuplicateEnrollmentException extends ConflictException` (enrollment) |

회차 경로에 과정 id를 넣지 않는다. 회차 id만으로 유일하고, 종료된 과정의 회차는 D-31로 모두 마감돼 409가 된다. 같은 과정의 다른 회차는 따로 신청할 수 있다 (D-08).

알려진 제한: 과정 종료와 회차 추가가 동시에 일어나면, 종료된 과정에 모집 중인 회차가 남을 수 있고 그 회차에는 신청이 된다. 신청은 회차 상태만 보고 과정 상태는 보지 않기 때문이다. 과정 행 락 또는 신청 시 과정 상태 확인으로 고치며 후속 이슈로 다룬다 (9절).

### 바뀌는 기존 API

| API | 변경 |
|---|---|
| `GET /api/v1/courses/{id}` | 회차의 `remainingSeats` = `capacity - confirmedCount` (D-37) |
| `PUT /api/v1/admin/courses/{courseId}/sessions/{sessionId}` | 확정자가 있는데 정원이 바뀌면 409 (D-38). 회차 행 락으로 조회 |
| `POST /api/v1/admin/courses/{id}/close`, `.../sessions/{sessionId}/close` | 회차 행 락으로 조회 (응답 변화 없음) |
| 관리자 회차 응답 `AdminSessionResponse` | `confirmedCount` 필드 추가 (정원 변경 가능 여부를 알 수 있게) |

## 4. 스키마 (`V2__create_enrollment.sql`)

```sql
-- D-37: 회차 확정 인원. 회차 행 락 안에서만 바꾼다 (D-29)
ALTER TABLE course_session
    ADD confirmed_count INT NOT NULL
        CONSTRAINT df_course_session_confirmed_count DEFAULT 0;
GO
-- 새 컬럼을 같은 배치에서 참조하면 컴파일 오류가 나므로 배치를 나눈다

-- NFR-01: 정원 초과의 마지막 방어선
ALTER TABLE course_session
    ADD CONSTRAINT ck_course_session_confirmed_count
        CHECK (confirmed_count >= 0 AND confirmed_count <= capacity);

-- 수강 신청 (FR-04~08). 상태: CONFIRMED, WAITING, CANCELLED, COMPLETED
CREATE TABLE enrollment (
    id            BIGINT IDENTITY(1, 1) NOT NULL,
    session_id    BIGINT       NOT NULL,
    employee_id   NVARCHAR(20) NOT NULL,
    status        NVARCHAR(20) NOT NULL,
    waiting_order BIGINT       NULL,      -- D-39: 대기 정렬 키. FR-05에서 채운다
    applied_at    DATETIME2(6) NOT NULL,
    CONSTRAINT pk_enrollment PRIMARY KEY (id),
    CONSTRAINT fk_enrollment_session FOREIGN KEY (session_id) REFERENCES course_session (id),
    CONSTRAINT ck_enrollment_status
        CHECK (status IN ('CONFIRMED', 'WAITING', 'CANCELLED', 'COMPLETED')),
    -- 대기가 아니면 정렬 키가 없다. FR-05에서 "WAITING이면 NOT NULL"로 강화한다
    CONSTRAINT ck_enrollment_waiting_order
        CHECK (status = 'WAITING' OR waiting_order IS NULL)
);

-- FR-04, D-07: 같은 회차에 확정·대기 신청은 한 사람당 하나. 취소·수료 뒤 재신청은 허용
CREATE UNIQUE INDEX ux_enrollment_active
    ON enrollment (session_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING');

-- D-39: 회차 안에서 대기 정렬 키는 유일하다. NULL 행은 필터에서 빠진다
CREATE UNIQUE INDEX ux_enrollment_waiting_order
    ON enrollment (session_id, waiting_order)
    WHERE waiting_order IS NOT NULL;

-- SQL Server는 FK 인덱스를 만들지 않는다 (NFR-02)
CREATE INDEX ix_enrollment_session_id ON enrollment (session_id);
-- FR-07 내 신청 내역 조회 대비
CREATE INDEX ix_enrollment_employee_id ON enrollment (employee_id);
```

- 기존 회차는 `DEFAULT 0`으로 채워진다 (하위 호환). 기존 행은 신청이 없으므로 0이 맞다.
- 필터 인덱스는 `QUOTED_IDENTIFIER`·`ANSI_NULLS`가 ON이어야 한다. MS JDBC 드라이버 기본값이 ON이다.
- Flyway는 SQL Server에서 `GO`로만 배치를 나눈다. 새 컬럼을 같은 배치에서 참조하면 오류가 나므로 `GO`로 나눈다 (T1에서 확인).

## 5. 엔티티·도메인

### `CourseSession` (course) 추가

```java
@Column(name = "confirmed_count", nullable = false)
private int confirmedCount;   // 생성자에서 0

public int getConfirmedCount()
public int getRemainingSeats() { return capacity - confirmedCount; }
public boolean hasRemainingSeat() { return confirmedCount < capacity; }
public boolean isOpen() { return status == CourseSessionStatus.OPEN; }

/** 확정 자리 하나를 차지한다 (D-37). 회차 행 락을 잡은 상태에서만 부른다 (D-29). */
public void occupySeat() {
  requireOpen();
  if (!hasRemainingSeat()) throw new CourseStateException("남은 자리가 없습니다: " + id);
  confirmedCount++;
}
```

- `update(startDate, place, capacity)`: `confirmedCount > 0 && capacity != this.capacity`면 `CourseStateException`(409, D-38)
- `SessionResponse.from`: `remainingSeats`에 `getRemainingSeats()` (D-16 주석을 D-37로 바꾼다)
- `AdminSessionResponse`: `confirmedCount` 추가

### `Enrollment` (enrollment/domain, 신규)

```java
@Entity @Table(name = "enrollment")
public class Enrollment {
  @Id @GeneratedValue(strategy = IDENTITY) Long id;
  @ManyToOne(fetch = LAZY, optional = false) @JoinColumn(name = "session_id", nullable = false) CourseSession session;
  @Column(name = "employee_id", nullable = false, length = 20) String employeeId;
  @Enumerated(STRING) @Column(nullable = false, length = 20) EnrollmentStatus status;
  @Column(name = "waiting_order") Long waitingOrder;   // FR-04에서는 항상 null (D-39)
  @Column(name = "applied_at", nullable = false) LocalDateTime appliedAt;

  protected Enrollment() {}
  public static Enrollment confirmed(CourseSession session, String employeeId, LocalDateTime appliedAt)
  public static Enrollment waiting(CourseSession session, String employeeId, LocalDateTime appliedAt)
}
```

- `EnrollmentStatus`: `CONFIRMED`, `WAITING`, `CANCELLED`, `COMPLETED` (스키마와 일치. 이번엔 앞의 둘만 만든다)
- `appliedAt`은 `Clock` 빈에서 얻는다(`LocalDateTime.now(clock)`). 테스트에서 시각을 고정하기 위해서다. `common/config`에 `Clock.systemDefaultZone()` 빈을 추가한다

## 6. Repository

### `CourseSessionRepository` (course) 추가

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select s from CourseSession s where s.id = :id")
Optional<CourseSession> findByIdForUpdate(Long id);

@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select s from CourseSession s where s.id = :id and s.course.id = :courseId")
Optional<CourseSession> findByIdAndCourseIdForUpdate(Long id, Long courseId);

@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select s from CourseSession s where s.course.id = :courseId and s.status = :status order by s.id")
List<CourseSession> findByCourseIdAndStatusForUpdate(Long courseId, CourseSessionStatus status);
```

Hibernate SQLServerDialect는 `PESSIMISTIC_WRITE`를 `with (updlock, holdlock, rowlock)` 힌트로 바꾼다. 실제 SQL은 리포지토리 테스트에서 SQL 로그로 확인한다. 여러 회차를 잡을 때는 id 순서로 잡아 교착을 피한다.

### `EnrollmentRepository` (enrollment/repository, 신규)

```java
boolean existsBySessionIdAndEmployeeIdAndStatusIn(
    Long sessionId, String employeeId, Collection<EnrollmentStatus> statuses);

boolean existsBySessionIdAndStatus(Long sessionId, EnrollmentStatus status);
```

## 7. Service, 트랜잭션 경계, 동시성

### 의존 방향 (D-29, NFR-07)

```
enrollment.controller → enrollment.service → course.service.SessionLockService → course.repository
                                            → enrollment.repository
```

- enrollment는 course의 `SessionLockService`와 `CourseSession` 엔티티만 쓴다. course의 리포지토리를 직접 부르지 않는다
- course는 enrollment를 import하지 않는다. ArchUnit 테스트는 범위 밖이며, reviewer가 import를 확인한다

### `SessionLockService` (course/service, 신규)

```java
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class SessionLockService {
  /** 회차 행을 비관적 락으로 잡는다 (D-29). 없으면 CourseSessionNotFoundException(404). */
  public CourseSession lock(Long sessionId)
}
```

`MANDATORY`로 호출자 트랜잭션 안에서만 쓰게 한다. 락이 호출자 트랜잭션이 끝날 때까지 유지돼야 하기 때문이다.

### 트랜잭션 경계

- 신청 한 건 = `EnrollmentService.enroll` 하나의 `@Transactional` (기본 격리 수준 READ COMMITTED)
- 락은 2단계에서 잡혀 커밋·롤백 때 풀린다. 그 사이 같은 회차의 다른 신청과 관리자 변경은 대기한다
- Controller에는 트랜잭션이 없다 (`open-in-view: false`). 응답 DTO는 서비스 안에서 만든다

### `EnrollmentService.enroll(Long sessionId, String employeeId)`

1. `employeeId = employeeId.trim()`
2. `session = sessionLockService.lock(sessionId)`: 같은 회차 신청은 여기서 한 줄로 선다 (NFR-01)
3. `session.isOpen()`이 아니면 `SessionClosedException` (409, D-04)
4. `existsBySessionIdAndEmployeeIdAndStatusIn(sessionId, employeeId, [CONFIRMED, WAITING])`면 `DuplicateEnrollmentException` (409, FR-04)
5. `session.hasRemainingSeat() && !existsBySessionIdAndStatus(sessionId, WAITING)`이면 `session.occupySeat()` 후 `Enrollment.confirmed(...)`. 아니면 `Enrollment.waiting(...)` (순번 없음, D-35). 대기자가 있으면 빈자리가 있어도 새 신청자를 확정하지 않는다. FR-04에선 취소가 없어 이 경우가 생기지 않지만, FR-06 전에 규칙을 고정해 둔다
6. `enrollmentRepository.saveAndFlush(enrollment)`. `DataIntegrityViolationException`이 나면 `DuplicateEnrollmentException`으로 바꾼다. 락이 있어 정상 경로에선 일어나지 않지만, 중복 방지는 DB 유일 제약이 최종 보장한다 (CLAUDE.md 개발 절차 6)
7. `EnrollmentResponse.from(enrollment)` 반환

`confirmed_count` 증가는 변경 감지로 커밋 때 반영된다. 락이 커밋까지 유지되므로 다음 신청자는 증가된 값을 읽는다.

### `AdminCourseService` 변경

- `updateSession`, `closeSession`: `findSession` 대신 `findByIdAndCourseIdForUpdate`로 조회
- `close(id)`(과정 종료): OPEN 회차를 `findByCourseIdAndStatusForUpdate`로 조회
- 이유: Hibernate는 기본적으로 모든 컬럼을 UPDATE한다. 락 없이 관리자가 회차를 수정하면, 그 사이 신청으로 늘어난 `confirmed_count`를 옛 값으로 덮어쓴다 (lost update). 회차를 바꾸는 모든 경로가 같은 락을 잡아야 한다

### 락 대기

- 회차 하나에 신청이 몰리면 줄을 선다. 한 신청의 락 구간은 조회 2~3번과 INSERT 1번이라 짧다
- 락 대기 시간 제한(`jakarta.persistence.lock.timeout`)은 이번엔 두지 않는다. 동시성 테스트에서 100건 처리 시간을 기록해 판단 근거로 남긴다
- 측정 결과 (개발 DB, Hikari 기본 풀 10): 마지막 1자리에 100건 동시 신청 1254ms, 같은 사번 20건 462ms, 신청 50건과 관리자 수정 5건 891ms. 락 대기 중인 신청도 연결을 잡고 있으므로, 회차 하나에 신청이 몰리면 풀이 먼저 소진돼 다른 API도 연결을 기다린다. 지금 수치로는 여유가 있으며, FR-06에서 락 대기 시간 제한을 다시 판단한다
- 동시성 테스트는 거짓 실패를 막으려고 테스트에서만 연결 대기 시간을 120초로 늘렸다. 운영 기본값은 30초다

## 8. 테스트 시나리오

### `EnrollmentServiceTest` (Mockito)

| # | 시나리오 | 기대 |
|---|---|---|
| S1 | 남은 자리 있고 대기 없음 | CONFIRMED, `occupySeat`로 `confirmedCount` 1 증가 |
| S2 | 남은 자리 없음 | WAITING, `waitingOrder` null, `confirmedCount` 그대로 |
| S3 | 남은 자리 있지만 대기자 있음 | WAITING (D-35) |
| S4 | 마감 회차 | `SessionClosedException`, save 안 함 |
| S5 | 이미 확정·대기 신청 있음 | `DuplicateEnrollmentException`, save 안 함 |
| S6 | 회차 없음 | `CourseSessionNotFoundException` |
| S7 | save에서 `DataIntegrityViolationException` | `DuplicateEnrollmentException` |
| S8 | employeeId 앞뒤 공백 | trim된 값으로 중복 검사·저장 |
| S9 | `appliedAt` | 고정 `Clock`의 시각 |

### `EnrollmentControllerTest` (`@WebMvcTest`)

- C1: 201과 응답 JSON(확정, 대기 각각). `waitingNumber` 필드가 없다
- C2: 본문 `employeeId`가 그대로 서비스 인자로 넘어간다 (`verify(service).enroll(3L, " E1 ")`)
- C3: `employeeId` 누락·공백·21자 → 400, 서비스 `never()`
- C4: 404·409가 `application/problem+json`

### `EnrollmentRepositoryTest` (`@DataJpaTest`, 개발 DB, 롤백)

- R1 `ux_enrollment_active`: 같은 회차·사번 WAITING 두 번 저장 → 예외
- R2 CANCELLED 행이 있으면 같은 사번 재신청 저장 성공 (D-07)
- R3 같은 회차에 WAITING 두 행이 둘 다 `waiting_order` NULL이어도 저장된다
- R4 `ck_enrollment_waiting_order`: CONFIRMED에 `waiting_order` 값이 있으면 예외
- R5 `ck_course_session_confirmed_count`: 정원보다 많은 `confirmed_count` 저장 → 예외
- R6 `existsBy...` 두 메서드의 참·거짓
- R7 `findByIdForUpdate` SQL에 `updlock` 힌트가 들어간다 (SQL 로그 확인, 자동 검증이 어려우면 수동 확인 결과를 PR에 기록)
  - 확인 결과 (T2, `CourseSessionLockRepositoryTest`): 락 조회 3개 모두 `from course_session cs1_0 with (updlock,holdlock,rowlock) where ...`로 나간다

### `CourseSession` 단위 테스트

E1 `occupySeat`는 정원까지 증가하고 초과하면 예외, E2 마감 회차 `occupySeat` 예외, E3 확정자 있을 때 정원 변경 예외·일정만 변경은 성공 (D-38), E4 `getRemainingSeats`.

### 기존 테스트 갱신

- `AdminCourseServiceTest`: `updateSession`·`closeSession`·`close`가 `...ForUpdate`를 호출
- `CourseControllerTest`·`CourseQueryService` 관련: 상세 `remainingSeats`가 `capacity - confirmedCount`

### `EnrollmentConcurrencyTest` (`@SpringBootTest`, 개발 DB, NFR-01)

- 준비: 고유 제목의 과정과 정원 10 회차를 만들고 확정 9명을 넣어 커밋한다 (남은 자리 1)
- 실행: 100개 스레드가 `CountDownLatch`로 동시에 서로 다른 사번으로 `enroll` 호출
- 확인: 확정 정확히 10(새로 1), `confirmed_count` 10, WAITING 99건(모두 `waiting_order` NULL), 호출 예외 0
- 같은 사번 동시 신청: 남은 자리가 많은 다른 회차에 같은 사번으로 20개 스레드 → 1건 성공, 19건 `DuplicateEnrollmentException`, 행 1개
- 신청과 관리자 수정 동시 실행: 정원 60·확정 9 회차에 신청 50건과 관리자 회차 수정 5건(정원 그대로) → `confirmed_count` == CONFIRMED 행 수 == 59
- 정리: 커밋된 데이터라 `@AfterEach`에서 만든 신청·회차·과정을 지운다 (D-40). 실행 시간을 로그로 남긴다
- 실행: `@Tag("concurrency")`로 기본 test에서 빠지며 `./gradlew concurrencyTest`로 직접 실행한다 (D-40)

## 9. 위험 영역

| 위험 | 대응 |
|---|---|
| 관리자 수정이 `confirmed_count`를 덮어씀 | 회차 변경 경로 모두 `ForUpdate` 조회 (7절), 테스트로 호출 확인 |
| SQL Server 락 에스컬레이션·교착 | 단일 행 `rowlock`, 여러 회차는 id 순, 동시성 테스트로 확인 |
| 신청자 본인 확인 없음 (NFR-03 미충족) | D-36에 명시, Controller `TODO(NFR-03)`. 인증 도입 때 교체 |
| 아무 사번으로 정원을 채우면 되돌릴 수단이 회차 마감뿐 (취소 API 없음, D-38로 정원 증가도 막힘) | D-41: NFR-03·FR-06 전에는 개발 DB 전용, 공유·운영 배포 금지 |
| 과정 종료와 회차 추가가 겹치면 종료된 과정의 회차에 신청 가능 | 3절 알려진 제한. 후속 이슈 (과정 행 락 또는 신청 시 과정 상태 확인) |
| FR-05 전까지 대기 순서는 `applied_at, id`로만 알 수 있음 | D-39에 명시. FR-05에서 `waiting_order` 백필 마이그레이션과 CHECK 강화 |
| 마감 뒤에도 대기 신청이 WAITING으로 남음 | D-38에 명시, FR-06에서 D-04 처리 |
| 동시성 테스트가 공유 개발 DB에 커밋 데이터 남김 | D-40: 기본 test에서 제외하고 수동 실행, `@AfterEach` 과정별 정리, 고유 제목으로 범위 한정 |
| 마이그레이션이 공유 개발 DB에 바로 적용됨 | 실행 전 SQL을 개발자에게 보여 준다 (eduhub-api 1절) |
