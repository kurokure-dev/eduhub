# EduHub

사내 교육과정 조회 및 수강 신청 시스템

## 폴더 구조

```
backend/                          Spring Boot 백엔드 (Java 21, Gradle Kotlin DSL)
  src/main/java/com/example/eduhub/
    common/                       도메인에 속하지 않는 공통 기능 (헬스 체크, 설정)
    course/                       과정·회차 도메인 (FR-01~03)
    enrollment/                   수강 신청·대기열·수료 도메인 (FR-04~09)
  src/main/resources/
    application.yml               모든 프로필 공통 설정
    application-dev.yml           로컬 개발 (SQL Server, 접속 정보는 환경 변수)
    db/migration/                 Flyway 마이그레이션 (스키마 변경은 여기서만)
  src/test/resources/
    application-test.yml          테스트 (개발 DB에 직접 연결)
docs/
  requirements.md                 요구사항과 결정 사항
```

## 백엔드 실행

필요한 것: JDK 21, 개발 DB(SQL Server) 접속

```bash
cd backend
./gradlew test            # 테스트 (개발 DB 접속 필요)
./gradlew spotlessCheck   # 포맷 검사 (자동 정리는 spotlessApply)
./gradlew bootRun         # 로컬 실행 (dev 프로필)
```

- `test`·`bootRun` 전에 저장소 루트의 `.env.example`을 `.env`로 복사하고 DB 접속 정보를 채운다. 환경 변수로 넘겨도 된다.
- 실행 후 확인: `GET http://localhost:8080/api/health`, API 문서는 `http://localhost:8080/swagger-ui.html`
