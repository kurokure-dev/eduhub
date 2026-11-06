# backend/CLAUDE.md

Spring Boot 3.5 백엔드 (Java 21, Gradle Kotlin DSL). 명령은 모두 `backend/`에서 실행한다.

## 테스트·빌드 명령

JDK 21이 필요하다. 이 PC에는 JDK 8·11도 있으므로 Java 버전 오류가 나면 `JAVA_HOME`이 `C:\Users\USER\.jdks\azul-21.0.13.0.3`을 가리키는지 확인한다.

```bash
./gradlew test                                                        # 전체 테스트 (개발 DB 접속 필요)
./gradlew test --tests "com.example.eduhub.common.health.HealthControllerTest"   # 테스트 클래스 하나
./gradlew test --tests "*HealthControllerTest.healthReturnsUp"        # 테스트 메서드 하나
./gradlew spotlessCheck                                               # 포맷 검사
./gradlew spotlessApply                                               # 포맷 자동 정리
./gradlew bootRun                                                     # 로컬 실행 (dev 프로필, 개발 DB 접속 필요)
```

- 작업을 마치기 전에 `./gradlew spotlessCheck test`를 통과시킨다. 포맷은 google-java-format(2칸 들여쓰기)이며 손으로 맞추지 말고 `./gradlew spotlessApply`를 쓴다
- Spotless의 google-java-format 버전은 지정하지 않는다 (Spotless 기본값 사용). 1.37.0을 지정하면 Spotless 8.9에서 `InvocationTargetException`으로 실패한다
- `gradle/wrapper/gradle-wrapper.jar`는 커밋한다. 루트 `.gitignore`에서 이 예외 줄은 `*.jar`보다 뒤에 있어야 적용된다

## 계층 규칙

- 패키지는 도메인 기준이다 (NFR-07): `course`(과정·회차, FR-01~03), `enrollment`(신청·대기열·취소·승급/강등·수료·알림, FR-04~09), `common`(헬스 체크, 설정, 공통 오류 처리). 각 도메인 안에서 계층을 나눈다
- 호출 방향은 Controller → Service → Repository다. Controller에서 Repository를 직접 호출하지 않는다

## JPA 규칙

- 연관관계는 LAZY로 둔다 (`@ManyToOne`·`@OneToOne`은 기본이 EAGER이므로 `fetch = FetchType.LAZY`를 명시)
- 엔티티를 API 응답으로 그대로 반환하지 않는다 (DTO 사용)
- `open-in-view: false`를 유지한다 (NFR-02, `src/main/resources/application.yml`)
- DB 스키마 변경은 Flyway 마이그레이션(`src/main/resources/db/migration`)으로만 한다. 하위 호환되게 쓰고, 되돌릴 때는 새 마이그레이션으로 고친다
- DB는 SQL Server다 (D-14). 마이그레이션은 T-SQL로 쓰고 문자열 컬럼은 `NVARCHAR`로 만든다. `ddl-auto: validate`라서 엔티티와 스키마가 어긋나면 기동과 테스트가 실패한다

## OpenAPI 규칙

- API는 code-first다. springdoc 애노테이션으로 문서를 만들고, 프론트 클라이언트는 이 스펙에서 생성한다 (NFR-04)
- springdoc은 `/api/**`만 문서화한다. 확인: `/swagger-ui.html`, 스펙 `/v3/api-docs`
- 오류 응답은 ProblemDetail 형식으로 통일한다

## 프로필 (NFR-06)

- `application.yml`: 공통. 기본 프로필이 `dev`라서 프로필 없이 실행하면 dev로 뜬다
- `application-dev.yml`: DB 접속 정보를 `DB_URL`·`DB_USERNAME`·`DB_PASSWORD` 환경 변수로 받는다. 루트 `.env`를 `optional:file:../.env[.properties]`로 읽으므로 `backend/`에서 실행해야 한다
- `src/test/resources/application-test.yml`: dev와 같은 `.env`로 개발 DB(SGY_EHUB)에 직접 연결한다 (D-15). `@DataJpaTest`에는 `@AutoConfigureTestDatabase(replace = NONE)`와 `@ActiveProfiles("test")`를 붙인다. 테스트는 롤백되지만, 새 마이그레이션은 테스트 실행만으로 개발 DB에 적용된다
