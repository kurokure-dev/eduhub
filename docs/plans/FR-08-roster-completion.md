# FR-08 회차 명단 조회와 수료 처리 구현계획

- 설계명세: `docs/design/FR-08-roster-completion.md`
- 브랜치: `feature/fr-08-roster-completion`
- 결정 사항: D-03, D-29, D-37, D-39, D-43, D-47, D-48
- 진행: 작업마다 implementer가 구현하고 reviewer가 검토한다. 심각·경고는 implementer가 고치고, 수정·재검토는 최대 2회까지 한다. 모든 작업이 끝나면 critical-reviewer가 최종 검토한다
- 규모 알림 (CLAUDE.md 개발 절차 5): 이 작업은 도메인·리포지토리·서비스 2개·컨트롤러에 걸친다. 작업 단위로 나눠 diff를 작게 유지한다. 마이그레이션은 없다

## 공통 규칙 (모든 작업)

- 명령은 `backend/`에서 실행한다. JDK 21(`JAVA_HOME=C:\Users\USER\.jdks\azul-21.0.13.0.3`)과 루트 `.env`가 필요하다
- 완료 명령은 작업별로 적은 테스트와 `./gradlew spotlessApply spotlessCheck`다. T3에서는 `./gradlew spotlessCheck test` 전체를 돌린다
- 패턴은 `.claude/skills/eduhub-api/SKILL.md`와 기존 enrollment 패키지(`MyEnrollment*`, `EnrollmentService`)를 따른다 (record DTO, setter 금지, 생성자 주입, `@DisplayName`은 한국어 + D-번호)
- 마이그레이션 파일(V1~V5)은 수정하지 않는다
- 커밋은 개발자가 요청할 때 한다

## 작업 순서

```
T1 수료 도메인·서비스 ─ T2 명단 조회 서비스 ─ T3 관리자 API ─ T4 API 클라이언트 재생성
```

---

## T1. 수료 처리 서비스 (D-47, D-48)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/domain/Enrollment.java` | `complete()` (설계명세 4절) |
| `enrollment/domain/CompletionFailureReason.java` (신규) | enum. 값마다 주석을 단다 |
| `enrollment/dto/CompletionRequest.java`, `CompletionResponse.java`, `CompletionFailure.java` (신규) | 설계명세 3·4절. `@Schema` |
| `enrollment/repository/EnrollmentRepository.java` | `List<Enrollment> findBySessionIdAndEmployeeIdIn(Long sessionId, Collection<String> employeeIds)` |
| `enrollment/service/SessionNotStartedException.java` (신규) | `ConflictException` 상속. 메시지: "회차 시작일 전에는 수료 처리할 수 없습니다: " + sessionId |
| `enrollment/service/CompletionService.java` (신규) | 설계명세 5절 "수료" 순서 그대로. `Clock`을 주입받는다 |

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../enrollment/domain/EnrollmentTest.java` (신규 또는 기존에 추가) | `complete()` 성공 1개, 실패 3개 |
| `test/.../enrollment/service/CompletionServiceTest.java` (신규) | 설계명세 6절 C1~C10. `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)` + `@ActiveProfiles("test")` + `@Import({CompletionService.class, SessionLockService.class, 고정 Clock 설정})`. 서비스를 부른 뒤 `flush`·`clear`하고 DB 상태를 다시 읽어 확인한다 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*CompletionServiceTest" --tests "*EnrollmentTest" --tests "*EnrollmentRepositoryTest"
```

---

## T2. 명단 조회 서비스 (D-48)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/dto/RosterResponse.java`, `RosterConfirmedEntry.java`, `RosterWaitingEntry.java` (신규) | 설계명세 3절. `@Schema` |
| `enrollment/repository/RosterSessionSummary.java`, `RosterRow.java` (신규, 내부 projection record) | 설계명세 5절 |
| `enrollment/repository/EnrollmentRepository.java` | `findRosterSummary`, `findRosterRows` (설계명세 5절, `@Param` 명시) |
| `enrollment/service/RosterService.java` (신규) | 설계명세 5절 "명단". 순번은 계정 없는 행을 빼기 **전에** 매긴다 |

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../enrollment/service/RosterServiceTest.java` (신규) | 설계명세 6절 R1~R7. employee 행은 `EmployeeRepository`나 네이티브 insert로 만든다. 사번은 고유하게, password_hash는 더미 값을 쓴다 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test --tests "*RosterServiceTest"
```

실제 SQL 2개를 보고에 붙인다. `SPRING_JPA_SHOW_SQL=true` 환경 변수로 한 번만 켜서 확인한다.

---

## T3. 관리자 명단·수료 API (FR-08, D-43)

**변경 파일**

| 파일 | 내용 |
|---|---|
| `enrollment/controller/AdminEnrollmentController.java` (신규) | `@GetMapping("/roster")`, `@PostMapping("/completions")`. 수료 요청은 `@Valid @RequestBody CompletionRequest`로 받는다. `@Operation` 설명에 D-47(시작일)과 D-48(부분 성공, 사유 코드)을 적는다. `@ApiResponse` 코드는 설계명세 3절 표대로 단다 |

**테스트**

| 파일 | 케이스 |
|---|---|
| `test/.../enrollment/controller/AdminEnrollmentControllerTest.java` (신규) | 설계명세 6절 W1~W5. `AdminCourseControllerTest`의 ADMIN·EMPLOYEE `jwt()` 패턴을 따른다 |

**완료 명령**

```bash
./gradlew spotlessApply spotlessCheck test
```

---

## T4. 프론트 API 클라이언트 재생성과 실행 확인 (NFR-04)

- bootRun(dev)을 띄우고 `frontend`에서 `npm run generate:api`를 돌린다. 이어서 두 앱의 `npx tsc --noEmit`과 테스트를 돌린다. 화면 코드는 바꾸지 않는다
- 확인 스크립트(`.env`의 개발 비밀번호를 쓰므로 개발자가 실행한다)로 다음을 본다
  - DEV-A001로 확인용 과정을 만들고, 시작일이 오늘인 회차를 만든다
  - DEV-E001이 신청한다
  - 명단 200(DEV-E001 포함)
  - 수료 `[DEV-E001, DEV-E002, 없는사번]`: 결과는 completed와 failed가 섞인다
  - 다시 수료하면 `ALREADY_COMPLETED`다
  - 시작일이 미래인 회차의 수료는 409, 빈 목록은 400, DEV-E001 토큰이면 403이다
