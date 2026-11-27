# FR-08 회차 명단 조회와 수료 처리 설계명세

- 요구사항: FR-08 (관리자는 회차별 신청자·대기자 명단을 보고 수료 처리한다), D-03 (확정자만 수료, 관리자만)
- 관련 결정: D-29, D-37, D-39, D-43, D-47·D-48 (이번에 추가), D-10·D-02 (갱신)
- 브랜치: `feature/fr-08-roster-completion`

## 1. 범위

**하는 것**
- `GET /api/v1/admin/sessions/{sessionId}/roster`: 회차 요약, 확정·수료자 명단, 대기자 명단(순번 포함)을 돌려준다
- `POST /api/v1/admin/sessions/{sessionId}/completions`: 사번 목록을 받아 확정자를 수료로 바꾸고, 사번마다 결과를 돌려준다

**하지 않는 것**
- 화면(admin-mfe), 알림(FR-09), 수료 취소, 마이그레이션(V6 없음)

**지시서와 다른 점 (사용자 결정)**
- 경로는 `/api/admin`이 아니라 `/api/v1/admin` 아래다. D-43과 SecurityConfig를 그대로 쓴다
- 수료 시점은 회차 시작일 기준이다(D-47). 마감 여부는 보지 않는다
- employee 계정이 없는 사번은 명단에서 뺀다(D-48)

## 2. 결정 사항 (`docs/requirements.md`)

| ID | 요약 |
|---|---|
| D-47 | 수료는 회차 시작일 당일부터 할 수 있고, 그 전이면 409다. 서버 `Clock` 날짜로 판단하고 마감 여부는 보지 않는다. D-10은 갱신하고, D-02에는 예외로 적는다 |
| D-48 | 명단 구성·정렬, 계정 없는 사번 제외(순번은 포함해 계산), 수료 요청 규칙(1~200개, 중복 제거, 부분 성공), 실패 사유 코드, `confirmed_count`를 유지한다 |
| D-46 (보완) | 대기에서 벗어나는 경로에 D-04(마감 시 대기 자동 취소)와 D-06(정원 증가 승급)을 추가한다. FR-07 최종 검토 P2 |

## 3. API

### `GET /api/v1/admin/sessions/{sessionId}/roster`

| 응답 | 조건 |
|---|---|
| 200 | `RosterResponse` |
| 401 | 토큰이 없거나 유효하지 않다 |
| 403 | ADMIN이 아니다 |
| 404 | 없는 회차 |

```json
{
  "sessionId": 811, "courseTitle": "Spring 입문", "sessionStartDate": "2026-12-08",
  "capacity": 20, "sessionStatus": "OPEN",
  "confirmed": [
    { "enrollmentId": 1, "employeeNo": "E001", "name": "홍길동", "status": "CONFIRMED", "appliedAt": "2026-11-20T09:00:00" }
  ],
  "waiting": [
    { "enrollmentId": 9, "employeeNo": "E010", "name": "김철수", "waitingRank": 1, "appliedAt": "2026-11-21T10:00:00" }
  ]
}
```
- `confirmed`: CONFIRMED와 COMPLETED. `applied_at, id` 오름차순으로 정렬한다
- `waiting`: WAITING. `waiting_order` 오름차순으로 정렬하고, `waitingRank`는 1부터 시작한다
- CANCELLED는 넣지 않는다

### `POST /api/v1/admin/sessions/{sessionId}/completions`

요청: `{ "employeeIds": ["E001", "E002"] }`

| 응답 | 조건 |
|---|---|
| 200 | `CompletionResponse` (부분 성공 포함) |
| 400 | 본문이 없다, `employeeIds`가 비었다, 201개 이상이다, 빈 사번이 있다, 20자를 넘는 사번이 있다 |
| 401 / 403 | 명단 조회와 같다 |
| 404 | 없는 회차 |
| 409 | 오늘(서버 `Clock`)이 회차 시작일보다 앞선다. 아무것도 바꾸지 않는다 |

```json
{ "completed": ["E001"], "failed": [ { "employeeId": "E002", "reason": "WAITING" } ] }
```

- 사번마다 판정한다. 중복 사번은 처음 나온 것만 처리하고, 결과 순서는 입력 순서를 따른다
- 사번 비교는 trim한 뒤 대소문자를 무시한다(D-48). 로그인·신청이 쓰는 DB 콜레이션(대소문자 무시)과 맞춘 것이다. 중복 제거와 사번별 묶기 모두 이 규칙을 따르고, 응답에는 입력 원문(처음 나온 것, trim 후)을 쓴다

| 그 회차에서 그 사번의 신청 | 결과 |
|---|---|
| CONFIRMED가 있다 | 수료 처리하고 `completed`에 넣는다 (COMPLETED가 함께 있는 비정상 데이터라도 CONFIRMED를 수료한다. D-49 이후 API로는 생기지 않는다) |
| WAITING이 있다 | `WAITING` |
| COMPLETED만 있다 | `ALREADY_COMPLETED` |
| 신청이 없거나 CANCELLED만 있다 | `NOT_ENROLLED` |

- CONFIRMED와 WAITING은 같은 사번에 동시에 있을 수 없다(`ux_enrollment_active`)

## 4. 구조

| 계층 | 클래스 | 내용 |
|---|---|---|
| Controller | `enrollment/controller/AdminEnrollmentController` | `@RequestMapping("/api/v1/admin/sessions/{sessionId}")`, `@Tag(name = "Admin Enrollment", description = "관리자 회차 명단·수료")` |
| Service | `enrollment/service/RosterService` | `@Transactional(readOnly = true)`, `RosterResponse getRoster(Long sessionId)` |
| Service | `enrollment/service/CompletionService` | `@Transactional`, `CompletionResponse complete(Long sessionId, List<String> employeeIds)` |
| 예외 | `enrollment/service/SessionNotStartedException` | `ConflictException` 상속, 409 |
| 도메인 | `Enrollment.complete()` | CONFIRMED가 아니면 `IllegalStateException`, 맞으면 COMPLETED로 바꾼다. `waiting_order`는 원래 NULL이다 |
| 도메인 | `enrollment/domain/CompletionFailureReason` | enum `WAITING`, `NOT_ENROLLED`, `ALREADY_COMPLETED` |
| DTO | `enrollment/dto/RosterResponse`, `RosterConfirmedEntry`, `RosterWaitingEntry`, `CompletionRequest`, `CompletionResponse`, `CompletionFailure` | record와 `@Schema` |

- 의존 방향
  - enrollment → course: `SessionLockService`, 없는 회차는 `CourseSessionNotFoundException`
  - enrollment → auth: `Employee` 엔티티를 JPQL에서 join
  - course와 auth는 enrollment를 참조하지 않는다(D-29)
- `CompletionRequest`: `@NotEmpty @Size(max = 200) List<@NotBlank @Size(max = 20) String> employeeIds`. 컨트롤러는 `@Valid @RequestBody`로 받는다. 검증 실패와 본문 없음은 기존 400 처리(ProblemDetail)로 간다. 사번은 `trim()`한 뒤 비교한다

## 5. 쿼리

### 명단 (쿼리 2개)

1. 회차 요약 projection. 없으면 404다
   ```java
   @Query("select new ...RosterSessionSummary(s.id, c.title, s.startDate, s.capacity, s.status)"
       + " from CourseSession s join s.course c where s.id = :sessionId")
   Optional<RosterSessionSummary> findRosterSummary(Long sessionId);
   ```
   (`EnrollmentRepository`에 둔다. enrollment → course 방향이다.)
2. 명단 행
   ```java
   @Query("""
       select new ...RosterRow(e.id, e.employeeId, emp.name, e.status, e.waitingOrder, e.appliedAt)
       from Enrollment e left join Employee emp on emp.employeeNo = e.employeeId
       where e.session.id = :sessionId and e.status in :statuses
       order by e.appliedAt, e.id
       """)
   List<RosterRow> findRosterRows(Long sessionId, Collection<EnrollmentStatus> statuses);
   ```
   - `RosterService`가 결과를 나눈다
     - 확정·수료 행은 조회 순서(신청순)를 그대로 쓴다
     - 대기 행은 `waitingOrder`로 정렬한 다음, **전체** 대기 행에 index+1로 순번을 매긴다
     - 그 뒤 `name == null`(계정 없음)인 행을 확정·대기 양쪽에서 뺀다
   - `RosterRow`는 서비스 내부용 record이고 API에 내보내지 않는다
   - 순번은 D-39 공식(같은 회차 대기 중 자신 이하 키의 개수)과 같다. 키가 회차 안에서 유일하기 때문이다
   - 인덱스는 기존 `ix_enrollment_session_id`를 쓴다

### 수료
1. `sessionLockService.lock(sessionId)`: 회차 행 락을 잡는다. 없으면 404다
2. `LocalDate.now(clock).isBefore(session.getStartDate())`이면 `SessionNotStartedException`을 던진다
3. 입력 사번을 trim하고 `LinkedHashSet`으로 중복을 제거한다
4. `findBySessionIdAndEmployeeIdIn(sessionId, ids)`로 그 회차 신청을 모두 가져온다(취소 포함). 사번별로 묶어 3절 표대로 판정하고 `enrollment.complete()`를 부른다. 저장은 dirty checking에 맡기고 트랜잭션 끝에 flush한다
5. `confirmed_count`는 바꾸지 않는다(D-48)

- 락: 신청 상태를 바꾸므로 같은 회차의 신청·취소(FR-06)·마감 처리와 직렬화한다(D-29). 주의: 락보다 먼저 회차 엔티티를 조회하지 않는다(`EnrollmentService`의 주석과 같은 이유)

## 6. 테스트 시나리오

### `CompletionServiceTest` (`@DataJpaTest` + `@Import({CompletionService, SessionLockService})` + 고정 Clock `@TestConfiguration`, 개발 DB, 롤백)
고정 시각은 2026-12-08 09:00이다. 회차 시작일은 케이스마다 정한다. 데이터는 고유 사번(UUID 조각)으로 만들고, 상태는 네이티브 SQL로 맞춘다.
- C1 **정상**: 확정 2명이 COMPLETED가 되고 `completed` 순서가 입력 순서다. 회차 `confirmed_count`는 그대로다
- C2 **대기**: `failed`의 reason이 `WAITING`이고 상태는 WAITING 그대로다(키도 유지)
- C3 **신청 없음**: 신청이 없는 사번과 CANCELLED만 있는 사번은 모두 `NOT_ENROLLED`다
- C4 **이미 수료**: COMPLETED만 있으면 `ALREADY_COMPLETED`다
- C5 **혼합·중복**: 확정·대기·없음이 섞이면 부분 성공한다. 같은 사번을 두 번 넣으면 결과에 한 번만 나온다
- C6 **시작일 전**: 시작일이 내일이면 `SessionNotStartedException`이고, 확정자는 CONFIRMED 그대로다
- C7 **시작일 당일**: 성공한다
- C8 **비정상 공존**: D-49 이전 데이터 등으로 같은 사번에 COMPLETED와 CONFIRMED가 함께 있으면 CONFIRMED가 수료되고 `completed`에 들어간다 (API로는 생기지 않는다)
- C9 **없는 회차**: `CourseSessionNotFoundException`
- C10 **계정 없는 사번**: 확정 신청이 있으면 수료된다

### `RosterServiceTest` (`@DataJpaTest` + `@Import(RosterService)`)
- R1 회차 요약(과정 제목, 시작일, 정원, 상태)이 맞다
- R2 확정·수료는 신청순이고 status가 맞다. 대기는 키순이고 순번이 1·2·3이다
- R3 취소 행과 다른 회차의 신청은 나오지 않는다
- R4 계정 없는 사번(확정·대기)은 빠진다. 그 사람이 대기 1번이면 남은 대기자의 순번은 2·3이다
- R5 이름이 employee 테이블 값이다
- R6 없는 회차는 `CourseSessionNotFoundException`
- R7 신청이 없으면 두 목록 모두 비어 있다

### `EnrollmentTest` (도메인 단위)
- `complete()`는 CONFIRMED를 COMPLETED로 바꾼다. WAITING·COMPLETED·CANCELLED이면 `IllegalStateException`이다

### `AdminEnrollmentControllerTest` (`@WebMvcTest` + `@Import(SecurityConfig)` + `@MockitoBean JwtDecoder`)
- W1 명단: ADMIN이면 200이고 JSON 필드가 맞다. EMPLOYEE면 403, 토큰 없으면 401이며 둘 다 서비스를 부르지 않는다
- W2 수료: ADMIN이면 200이고 응답이 `completed`·`failed` 형식이다. 서비스에 사번 목록이 그대로 넘어간다
- W3 수료 400: 빈 목록, 본문 없음, `employeeIds` 누락, 201개, 빈 사번. 모두 서비스를 부르지 않는다
- W4 수료: 서비스가 `SessionNotStartedException`을 던지면 409, `CourseSessionNotFoundException`을 던지면 404이고 둘 다 ProblemDetail이다
- W5 수료: EMPLOYEE면 403이다

## 7. 위험 영역
- **락 순서**: 수료는 회차 락을 잡은 뒤 신청 행을 바꾼다. 신청과 같은 순서(회차 → 신청)이므로 교착 위험이 늘지 않는다
- **OPEN 회차의 수료(D-47)**: 시작일이 지난 모집 중 회차에서는 수료와 신청이 섞인다. 수료자는 `confirmed_count`를 유지하므로 정원은 넘지 않는다. FR-06 취소는 COMPLETED를 대상으로 삼지 않는다
- **Clock 시간대**: `Clock.systemDefaultZone()`이므로 서버 시간대의 날짜를 쓴다. 서버가 UTC면 한국 시각 오전 9시 전에는 하루 늦게 판단한다. 지금 개발 서버는 KST다. 배포 대상이 정해지면 다시 본다
- **ad hoc join**: Hibernate 6의 엔티티 join(`left join Employee emp on ...`)을 쓴다. 문자열 컬럼끼리 비교하며, `uq_employee_employee_no`와 enrollment 쪽 인덱스가 있다
