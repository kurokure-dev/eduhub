# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 팀 규칙
- 요구사항은 docs/requirements.md를 기준으로 한다 (결정 사항 D-xx 포함)
- 백엔드 빌드·테스트: cd backend && ./gradlew test
- 계층 규칙: Controller → Service → Repository. Controller에서 Repository 직접 호출 금지
- 엔티티를 API 응답으로 그대로 반환하지 않는다 (DTO 사용)
- 비밀 정보는 코드와 설정 파일에 쓰지 않는다. 환경 변수와 .env(커밋 금지)만 사용

## 프로젝트

EduHub: 사내 교육과정 조회 및 수강 신청 시스템. 임직원이 회차에 신청하고, 정원이 차면 대기자로 등록된다.

- 요구사항과 업무 규칙의 기준은 `docs/requirements.md`다. 기능(FR-01~09), 비기능(NFR-01~08), **결정 사항(D-01~13)** 이 있다. 규칙이 애매하면 코드를 짐작으로 쓰지 말고 결정 사항을 먼저 확인하고, 없으면 사용자에게 묻고 답을 결정 사항에 D-번호로 추가한다.
- 지금은 백엔드 뼈대만 있다 (헬스 체크 API 하나, 엔티티 없음). 프론트엔드(React 18 + TypeScript, Module Federation: shell, course-mfe, enrollment-mfe, npm workspaces)는 아직 만들지 않았다.
- 문서, 주석, 커밋 메시지는 한국어로 쓴다. 설정 파일의 주석에는 관련 NFR 번호를 단다 (예: `# NFR-02: ...`).

## 명령 (모두 `backend/`에서 실행)

JDK 21이 필요하다. 이 PC에는 JDK 8·11도 있으므로 빌드가 Java 버전 오류로 실패하면 `JAVA_HOME`이 21(`C:\Users\USER\.jdks\azul-21.0.13.0.3`)을 가리키는지 확인한다.

```bash
./gradlew test                                                        # 전체 테스트
./gradlew test --tests "com.example.eduhub.common.health.HealthControllerTest"   # 테스트 클래스 하나
./gradlew test --tests "*HealthControllerTest.healthReturnsUp"        # 테스트 메서드 하나
./gradlew spotlessCheck                                               # 포맷 검사
./gradlew spotlessApply                                               # 포맷 자동 정리
./gradlew bootRun                                                     # 로컬 실행 (dev 프로필, PostgreSQL 필요)
```

- 작업을 마치기 전에 `./gradlew spotlessCheck test`를 통과시킨다. 포맷은 google-java-format(2칸 들여쓰기)이며 손으로 맞추지 말고 `spotlessApply`를 쓴다.
- `bootRun` 확인: `GET /api/health`, API 문서 `/swagger-ui.html`, 스펙 `/v3/api-docs`.

## 구조와 설정의 큰 그림

- 패키지는 도메인 기준이다 (NFR-07): `course`(과정·회차, FR-01~03), `enrollment`(신청·대기열·취소·승급/강등·수료·알림, FR-04~09), `common`(헬스 체크, 설정, 공통 오류 처리). 각 도메인 안에서 계층을 나눈다.
- 프로필 (NFR-06):
  - `application.yml`: 공통. 기본 프로필이 `dev`라서 프로필 없이 실행하면 dev로 뜬다. `open-in-view: false`(NFR-02), ProblemDetail 오류 형식, springdoc은 `/api/**`만 문서화.
  - `application-dev.yml`: DB 접속 정보를 `DB_URL`·`DB_USERNAME`·`DB_PASSWORD` 환경 변수로 받는다. 저장소 루트의 `.env`를 `optional:file:../.env[.properties]`로 읽으므로 **`backend/`에서 실행한다는 가정**이 있다. 새 환경 변수를 쓰면 `.env.example`에 이름만 추가한다.
  - `src/test/resources/application-test.yml`: DataSource·JPA·Flyway 자동 설정을 꺼서 DB 없이 테스트가 돈다. **엔티티를 추가하면 이 설정으로는 테스트가 깨진다.** 그때는 H2가 아니라 Testcontainers(PostgreSQL)로 바꾼다. H2는 락 동작이 달라 NFR-01(동시성) 검증에 쓸 수 없다.
- API는 code-first다. springdoc 애노테이션으로 문서를 만들고, 프론트 클라이언트는 이 스펙에서 생성할 예정이다 (NFR-04). 오류 응답은 ProblemDetail로 통일한다.
- DB 스키마 변경은 Flyway 마이그레이션(`src/main/resources/db/migration`)으로만 한다. 하위 호환되게 쓰고, 되돌릴 때는 새 마이그레이션으로 고친다.

## 설계할 때 주의할 업무 규칙

`docs/requirements.md`의 결정 사항 중 설계에 직접 영향을 주는 것:

- **동시성 (NFR-01)**: 100명이 마지막 1자리에 동시 신청해도 정원을 넘으면 안 된다. 신청, 취소에 따른 자동 승급(D-01), 정원 증감에 따른 승급·강등(D-05, D-06), 마감 시 대기 자동 취소(D-04)가 모두 한 회차의 대기열을 바꾸므로 회차 단위로 직렬화해야 한다.
- **대기 순번은 신청 시각 순서가 아니다**: 정원 감소로 강등된 확정자는 대기 맨 앞으로 간다(D-12). 그래서 대기열에는 신청 시각과 별개의 정렬 키가 필요하다. 대기자가 취소하면 뒷순번이 당겨지고(D-01), 신청 내역 조회 때 현재 순번을 보여 준다(D-09).
- **"종료"는 모집 마감이다 (D-11)**: 회차의 시작·끝 시점은 관리하지 않는다(D-02). 취소와 정원 변경은 마감 전까지만, 수료 처리는 마감 뒤 언제든 할 수 있다(D-02, D-10, D-13). 별도의 미수료 상태는 없다.
- **중복 신청**: 같은 회차에 확정·대기 상태가 동시에 둘일 수 없지만, 취소 후 재신청은 된다(D-07). 같은 과정의 다른 회차는 동시에 신청할 수 있다(D-08).
- **아직 정하지 않은 것**: 회차의 정원·대기열을 `course`와 `enrollment` 중 어디서 소유하고 락을 잡을지 (NFR-01과 NFR-07이 부딪힘), 인증 방식(NFR-03), CI 플랫폼, 배포 대상. 이 결정이 필요한 작업이면 먼저 사용자에게 묻는다.

## 저장소 규칙

- 커밋 메시지는 Conventional Commits 형식이다 (예: `feat(backend): ...`, `docs: ...`). 작업은 `feature/*` 브랜치에서 하고 `main`으로 PR을 연다.
- 줄바꿈은 `.gitattributes`로 LF로 고정한다 (`*.bat`만 CRLF). Spotless 검사도 이에 의존한다.
- `backend/gradle/wrapper/gradle-wrapper.jar`는 커밋한다. `.gitignore`에서 이 예외 줄은 `*.jar`보다 **뒤에** 있어야 적용된다.
- Spotless의 google-java-format 버전은 지정하지 않는다 (Spotless 기본값 사용). 1.37.0을 지정하면 Spotless 8.9에서 `InvocationTargetException`으로 실패한다.
