---
name: eduhub-api
description: EduHub 백엔드에 REST API를 추가하거나 바꿀 때 쓴다. 새 엔드포인트 추가, 기존 API의 요청·응답·오류 변경, 새 기능(FR)의 백엔드 구현(Flyway 마이그레이션, 엔티티, DTO, Repository, Service, Controller, 테스트, 프론트 API 클라이언트 재생성)에 이 절차를 따른다. 화면만 바꾸는 작업이나 빌드·설정만 바꾸는 작업에는 쓰지 않는다.
---

# EduHub 백엔드 API 추가 절차

시작 전에 `docs/requirements.md`의 FR과 결정 사항(D-xx)을 확인한다. 규칙이 애매하면 짐작하지 말고 사용자에게 묻고, 답을 D-번호로 추가한다.
기준 예시는 `backend/.../course` 패키지다. 조회는 `CourseController`·`CourseQueryService`, 변경은 `AdminCourseController`·`AdminCourseService`를 본다.
패키지는 `<도메인>/{domain, repository, service, controller, dto}`, 공통은 `common/{api, error}`. 호출 방향은 Controller → Service → Repository만 허용한다.

## 1. Flyway (스키마가 바뀔 때만)
- `src/main/resources/db/migration/V{다음 번호}__{설명}.sql`. 이미 적용된 마이그레이션 파일은 고치지 않는다.
- SQL Server T-SQL로 쓴다 (D-14): 문자열은 `NVARCHAR`, id는 `BIGINT IDENTITY(1, 1)`, 제약 이름은 `pk_`·`fk_`·`ck_`, FK 컬럼에는 `ix_` 인덱스를 직접 만든다.
- 테스트만 돌려도 공유 개발 DB(SGY_EHUB)에 적용된다 (D-15). 실행 전에 SQL을 사용자에게 보여 준다.

## 2. 엔티티 (`domain`)
- setter 금지. 생성은 public 생성자에서 초기 상태까지 정하고, 기본 생성자는 `protected`.
- 변경은 의도가 드러나는 메서드(`update(...)`, `close()`)로만 한다. 상태 검사는 엔티티 안에서 하고(`requireOpen()`), 어기면 `ConflictException` 계열 도메인 예외를 던진다.
- 연관은 `@ManyToOne(fetch = FetchType.LAZY, optional = false)` 단방향. 부모에 자식 컬렉션을 두지 않는다.
- enum은 `@Enumerated(EnumType.STRING)`. `@Column`의 `length`·`nullable`은 마이그레이션과 같게 맞춘다 (`ddl-auto: validate`).

## 3. DTO (`dto`, 관리자용은 `dto/admin`)
- 모두 `record`. 응답은 `static from(엔티티)`·`of(...)` 팩터리로 만들고, 엔티티를 API 응답으로 그대로 내보내지 않는다.
- 요청 record에 Bean Validation을 단다: `@NotBlank`, `@NotNull`, `@Size(max = 컬럼 길이)`, `@Min`. 필드마다 `@Schema(description, example)`.
- 페이지 응답은 `PageResponse.from(page.map(XxxResponse::from))`.

## 4. Repository
- `JpaRepository<엔티티, Long>`. 단순 조건은 메서드 이름 쿼리, 선택 조건은 JPQL `@Query`의 `(:p is null or ...)` 패턴.
- 목록은 `Page<>`와 `Pageable`. 연관을 따라가는 조회는 N+1이 없는지 확인한다 (NFR-02).
- 자식은 부모 id를 함께 걸어 찾는다 (예: `findByIdAndCourseId`). 다른 부모의 자식을 바꾸지 못하게 하기 위해서다.

## 5. Service (`@Transactional` 규칙)
- 조회와 변경을 나눈다: `XxxQueryService`는 클래스에 `@Transactional(readOnly = true)`, `AdminXxxService`는 클래스에 `@Transactional`이고 그 안의 조회 메서드에만 `@Transactional(readOnly = true)`.
- 변경은 조회한 엔티티의 메서드를 부르고 변경 감지로 저장한다. 새로 만들 때만 `save`.
- 입력 정리는 서비스에서: 문자열 `trim()`, 빈 값은 `blankToNull`.
- 없으면 `XxxNotFoundException extends NotFoundException`(404)을 서비스 패키지에 만든다. 생성자 주입만 쓴다 (Lombok 없음).

## 6. Controller (OpenAPI, 예외 → HTTP 상태)
- 경로는 `/api/v1/<자원>`, 관리자 API는 별도 컨트롤러에 `/api/v1/admin/<자원>` (D-30).
- 클래스에 `@Tag`, 메서드마다 `@Operation(summary, description)`. description에 관련 D-번호를 적는다.
- 오류 상태마다 `@ApiResponse(responseCode, description, content = @Content(schema = @Schema(implementation = ProblemDetail.class)))`.
- 요청 본문은 `@Valid @RequestBody`. 등록은 `@ResponseStatus(HttpStatus.CREATED)`, 상태 변경은 `POST /{id}/close`처럼 동작 경로로 만든다.
- 목록은 `@ParameterObject @PageableDefault(size = 10, sort = "id", direction = Sort.Direction.DESC) Pageable`. 정렬 필드는 `SORTABLE_PROPERTIES`로 검사해 `InvalidSortException`.
- 예외와 상태: `NotFoundException` → 404, `ConflictException` → 409, `InvalidSortException` → 400 (`GlobalExceptionHandler`), `@Valid` 실패 → 400 (Spring 기본). 응답은 항상 ProblemDetail이다. 새 종류가 필요하면 `common/error`에 기반 예외와 핸들러를 추가한다.

## 7. 테스트
- Controller: `@WebMvcTest(XxxController.class)`와 `@MockitoBean` 서비스. 성공 JSON, 기본 `Pageable`, 검증 실패 400(서비스는 `never()`), 404·409가 `application/problem+json`인지 확인한다.
- Service: `@ExtendWith(MockitoExtension.class)`, `@Mock` 리포지토리, `@InjectMocks`. 결정 사항(D-xx)의 상태 규칙과 예외를 확인한다 (NFR-05: 서비스 커버리지 70%).
- Repository: `@DataJpaTest`, `@AutoConfigureTestDatabase(replace = NONE)`, `@ActiveProfiles("test")`. 개발 DB를 공유하므로 `@BeforeEach`에서 고유 값(UUID 조각)을 만들어 결과를 좁히고, `flush()`·`clear()` 뒤 다시 조회해 확인한다.
- 이름은 영어 메서드명에 한국어 `@DisplayName`, 관련 D-번호를 붙인다.

## 8. 프론트 API 클라이언트 재생성
- 백엔드를 **8080**으로 띄운다(`cd backend && ./gradlew bootRun`). 다른 포트로 생성하면 `openapi.json`과 `base.ts`에 그 포트가 들어간다.
- `cd frontend && npm run generate:api`. `packages/api-client`의 `openapi.json`과 `src/generated`를 함께 커밋하고, 손으로 고치지 않는다.
- 그 API를 쓰는 앱에서 `npm test -w apps/<앱>`과 `npx tsc --noEmit`을 돌린다.

## 검증
```bash
cd backend && ./gradlew spotlessApply test
```
- JDK 21과 개발 DB 접속 정보(루트 `.env`)가 필요하다 (`backend/CLAUDE.md`).
- 통과하면 바뀐 파일, 새 마이그레이션, 추가한 D-번호, 확인하지 못한 것을 정리해 보고한다. 커밋·PR은 사용자가 요청할 때만 한다.
