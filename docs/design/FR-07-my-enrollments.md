# FR-07 내 신청 내역 조회 설계명세

- 요구사항: FR-07 (내 신청 내역 조회), D-09 (현재 대기 순번 표시), NFR-02 (조회 성능), NFR-03 (인증)
- 관련 결정: D-01, D-29, D-39, D-44, D-46 (이번에 추가)
- 브랜치: `feature/fr-07-my-enrollments`

## 1. 범위

**하는 것**
- `GET /api/me/enrollments?status=`: 로그인한 사원의 신청 내역을 최근 신청순으로 보여 준다. `status`로 거를 수 있다
- 대기 신청의 현재 순번은 저장하지 않고 조회할 때 계산한다 (D-39)
- 새 대기 신청에 정렬 키(`waiting_order`)를 부여한다. FR-05에서 하기로 했던 일을 앞당긴다 (D-46)
- V5 마이그레이션: 기존 대기 행에 키를 채우고, CHECK 제약을 강화하고, 조회용 인덱스를 추가한다

**하지 않는 것**
- 화면 (course-mfe의 내 신청 화면)
- FR-08 (관리자 명단·수료), FR-06 (취소), FR-05의 강등 키(최소값 - 1, D-12)
- 페이징. 사원 한 명의 신청 수는 적다

## 2. 결정 사항 (`docs/requirements.md`)

| ID | 항목 | 내용 |
|---|---|---|
| D-46 | 대기 키 부여 시점 | 새 대기 신청의 `waiting_order` 부여(회차 최대값 + 1, 없으면 1)는 FR-07에서 앞당겨 구현한다. FR-07의 순번 계산(D-39)에 키가 필요하기 때문이다. 기존 대기 행은 V5가 회차별 `applied_at, id` 순으로 채운다. 강등자에게 최소값 - 1을 주는 일(D-12)은 FR-05에 남긴다 |

D-39의 "키 부여는 FR-05에서 한다. 그 전에 저장된 대기 신청은 FR-05 마이그레이션이 채운다"는 D-46을 가리키도록 고친다.

## 3. API

### `GET /api/me/enrollments`

| 항목 | 내용 |
|---|---|
| 인증 | 필요. 토큰의 사번(`CurrentUser.from(jwt).employeeNo()`, D-44)으로만 조회한다. 사번을 받는 파라미터는 없다 |
| 쿼리 | `status` (선택): `CONFIRMED`, `WAITING`, `CANCELLED`, `COMPLETED`. 생략하면 전체 |
| 정렬 | `appliedAt` 내림차순, 같으면 `enrollmentId` 내림차순 |
| 200 | `MyEnrollmentResponse[]` (없으면 빈 배열) |
| 400 | `status` 값이 enum이 아님 (Spring 기본 타입 변환 오류. 관리자 과정 목록의 `status`와 같은 방식) |
| 401 | 토큰 없음·위조·만료 (ProblemDetail, SecurityConfig의 기존 처리) |

`MyEnrollmentController`(`enrollment/controller`, 새 파일)에 둔다. `EnrollmentController`는 클래스 경로가 `/api/v1/sessions/{sessionId}/enrollments`로 고정돼 있어 같이 둘 수 없다. 보안 설정은 바꾸지 않는다(`anyRequest().authenticated()`에 걸린다).

### `MyEnrollmentResponse` (record, `enrollment/dto`)

| 필드 | 타입 | 설명 |
|---|---|---|
| `enrollmentId` | Long | 신청 ID |
| `sessionId` | Long | 회차 ID |
| `courseTitle` | String | 과정 제목 |
| `sessionStartDate` | LocalDate | 회차 시작일 (표시용, D-02) |
| `sessionPlace` | String | 회차 장소 |
| `status` | EnrollmentStatus | 신청 상태 |
| `waitingRank` | Long, nullable | 현재 대기 순번(1부터). `WAITING`일 때만 값이 있다 (D-09) |
| `appliedAt` | LocalDateTime | 신청 일시 |

## 4. 조회 쿼리 (SQL 1개)

`EnrollmentRepository.findMine`은 JPQL 생성자 표현식이다. 과정과 회차는 join으로, 대기 순번은 select 안의 상관 서브쿼리로 가져온다. 엔티티를 로딩하지 않으므로 지연 로딩도 N+1도 생기지 않는다.

```java
@Query("""
    select new com.example.eduhub.enrollment.dto.MyEnrollmentResponse(
      e.id, s.id, c.title, s.startDate, s.place, e.status,
      case when e.status = com.example.eduhub.enrollment.domain.EnrollmentStatus.WAITING
           then (select count(w) from Enrollment w
                 where w.session = s
                   and w.status = com.example.eduhub.enrollment.domain.EnrollmentStatus.WAITING
                   and w.waitingOrder <= e.waitingOrder)
      end,
      e.appliedAt)
    from Enrollment e join e.session s join s.course c
    where e.employeeId = :employeeNo
      and (:status is null or e.status = :status)
    order by e.appliedAt desc, e.id desc
    """)
List<MyEnrollmentResponse> findMine(
    @Param("employeeNo") String employeeNo, @Param("status") @Nullable EnrollmentStatus status);
```

- 순번 = 같은 회차의 대기 중 내 키 이하의 개수 (D-39). 대기자가 취소되면(FR-06에서 상태를 바꾸고 키를 NULL로 만든다) 뒷순번이 저절로 당겨진다 (D-01)
- 의존 방향: enrollment → course 조인만 있다 (D-29)
- `MyEnrollmentQueryService.findMine(employeeNo, status)`: `@Transactional(readOnly = true)`, Repository 결과를 그대로 돌려준다. Controller → Service → Repository

## 5. 대기 키 부여 (D-46)

- `EnrollmentRepository.findMaxWaitingOrder(Long sessionId)`: `select max(e.waitingOrder) from Enrollment e where e.session.id = :sessionId`. 결과는 `Optional<Long>`
- `EnrollmentService.enroll`의 대기 분기에서는 회차 행 락(D-29)을 잡은 뒤 `findMaxWaitingOrder(sessionId).orElse(0L) + 1`을 부여한다. 락 안에서 읽으므로 같은 회차의 신청은 직렬화된다. 유일 인덱스 `ux_enrollment_waiting_order`가 마지막 방어선이다
- `Enrollment.waiting(session, employeeId, appliedAt, waitingOrder)`: 키는 필수(null 금지)다. 확정 신청의 키는 계속 null이다
- 최대값은 대기 중이 아닌 행까지 포함해도 된다. 대기가 아닌 행은 CHECK 제약상 키가 NULL이라 결과가 같다

## 6. 스키마 (`V5__waiting_order_and_my_enrollment_index.sql`)

```sql
-- D-39, D-46: 기존 대기 신청에 회차별 (applied_at, id) 순서로 정렬 키를 채운다
WITH ordered AS (
    SELECT waiting_order,
           ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY applied_at, id) AS rn
    FROM enrollment
    WHERE status = 'WAITING'
)
UPDATE ordered SET waiting_order = rn;

-- D-39: 대기면 정렬 키가 반드시 있고, 대기가 아니면 없다 (V2 제약 강화)
ALTER TABLE enrollment DROP CONSTRAINT ck_enrollment_waiting_order;
ALTER TABLE enrollment ADD CONSTRAINT ck_enrollment_waiting_order
    CHECK ((status = 'WAITING' AND waiting_order IS NOT NULL)
        OR (status <> 'WAITING' AND waiting_order IS NULL));

-- NFR-02, FR-07: 내 신청 조회. 사번 검색과 최근 신청순 정렬을 인덱스 하나로 끝낸다
CREATE INDEX ix_enrollment_employee_applied
    ON enrollment (employee_id, applied_at DESC, id DESC)
    INCLUDE (session_id, status, waiting_order);

-- 새 인덱스의 앞부분(employee_id)과 겹친다
DROP INDEX ix_enrollment_employee_id ON enrollment;
```

- 순번 서브쿼리는 기존 필터 유일 인덱스 `ux_enrollment_waiting_order (session_id, waiting_order)`를 쓴다
- 테스트만 돌려도 공유 개발 DB(SGY_EHUB)에 적용된다. 되돌리려면 V6이 필요하다
- 한 배치에서 실패하면(제약 삭제·추가) 문장 사이에 `GO`를 넣는다 (V2와 같은 방식)

## 7. 테스트 시나리오

### `MyEnrollmentQueryServiceTest` (`@DataJpaTest` + `@Import(MyEnrollmentQueryService)`, 개발 DB, 롤백)
- M1 **내 것만**: A·B 사원의 신청을 섞어 만들면 A로 조회했을 때 A의 것만 나온다
- M2 **상태 필터**: `WAITING`이면 대기만 나오고, `null`이면 전체가 최근 신청순(같은 시각이면 id 내림차순)으로 나온다
- M3 **필드**: 과정 제목, 회차 ID, 시작일, 장소, 상태, 신청 일시가 맞다
- M4 **대기 순번**: 한 회차에 확정 1명과 대기 3명(키 1, 2, 3)이 있으면 순번은 1·2·3이다. 확정 행의 순번은 null이다
- M5 **당겨짐 (D-01)**: 대기 1번 행을 네이티브 SQL로 `CANCELLED` + 키 NULL로 바꾸면 남은 대기자의 순번이 1·2가 된다. 취소 행의 순번은 null이다
- M6 **회차별 순번**: 다른 회차의 대기자는 내 순번에 영향을 주지 않는다
- M7 **SQL 1개**: 회차 3개에 신청을 만들고 `flush`·`clear`, `Statistics.clear()`를 한 뒤 조회하면 `getPrepareStatementCount() == 1`이다
- M8 신청이 없으면 빈 목록이다

통계는 `application-test.yml`에 `spring.jpa.properties.hibernate.generate_statistics: true`로 켠다. 세션마다 찍히는 통계 로그는 `logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener: WARN`으로 끈다. `Statistics`는 `entityManager.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics()`로 얻는다.

### `MyEnrollmentControllerTest` (`@WebMvcTest` + `@Import(SecurityConfig.class)` + `@MockitoBean JwtDecoder`)
- C1 `jwt()`의 `employee_no` 클레임이 서비스에 그대로 넘어가고, 응답 JSON 필드가 맞다 (`waitingRank` 포함)
- C2 `?status=WAITING`이면 서비스가 `WAITING`을 받는다. 생략하면 `null`을 받는다
- C3 토큰이 없으면 401이고 서비스를 부르지 않는다
- C4 `?status=FOO`면 400이고 서비스를 부르지 않는다

### 키 부여
- `EnrollmentServiceTest` (Mockito): 대기 분기에서 `findMaxWaitingOrder`가 비어 있으면 키 1, 5면 키 6이 저장된다. 확정 분기는 키가 null이다
- `EnrollmentRepositoryTest`:
  - R3을 바꾼다. 서로 다른 사번의 대기 두 행에 키 1과 2를 주면 저장된다. 같은 키를 주면 `ux_enrollment_waiting_order`로 거부된다
  - 새 R: 대기 행을 키 없이 넣으면 `ck_enrollment_waiting_order`로 거부된다
  - 새 R: `findMaxWaitingOrder`는 회차별 최대값을 돌려주고, 대기가 없으면 빈 값을 돌려준다
- `EnrollmentConcurrencyTest` (기본 제외, 수동 실행): "키가 채워진 대기 행 0개"를 "대기 99행의 키가 1~99로 중복 없음"으로 바꾼다

## 8. 위험 영역

- **공유 개발 DB 마이그레이션**: 기존 대기 행이 키로 채워지고 제약이 강화된다. implementer는 V5 SQL 전문을 보고하고 멈춘다. 개발자가 승인한 뒤 테스트를 돌린다
- **CHECK 강화의 후속 영향**: FR-06(취소)과 FR-05(승급)는 상태를 바꿀 때 키도 함께 바꿔야 한다. 대기에서 벗어나면 NULL이 된다. D-46에 적는다
- **통계 설정**: `generate_statistics`는 테스트 프로필에만 켠다. 운영 설정은 바꾸지 않는다
- **순번 서브쿼리 비용**: 대기 행마다 상관 서브쿼리가 한 번씩 돈다. 사원 한 명의 대기 수는 적고, 서브쿼리는 `(session_id, waiting_order)` 인덱스 범위 검색이라 괜찮다
