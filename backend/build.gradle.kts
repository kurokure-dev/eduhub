plugins {
    java
    id("org.springframework.boot") version "3.5.16"
    id("io.spring.dependency-management") version "1.1.7"
    id("com.diffplug.spotless") version "8.9.0"
}

group = "com.example"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-sqlserver")
    // NFR-04: 모든 API의 OpenAPI 문서 (Swagger UI: /swagger-ui.html)
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.17")
    runtimeOnly("com.microsoft.sqlserver:mssql-jdbc")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

// NFR-01, D-40: 기본 test는 공유 개발 DB에 커밋하는 동시성 테스트(concurrency 태그)를 제외한다
tasks.test {
    useJUnitPlatform {
        excludeTags("concurrency")
    }
}

// NFR-01, D-40: 동시성 테스트는 개발자가 직접 실행한다. check에는 연결하지 않는다
tasks.register<Test>("concurrencyTest") {
    group = "verification"
    description = "공유 개발 DB에 커밋하는 동시성 테스트 (수동 실행, D-40)"
    testClassesDirs = sourceSets.test.get().output.classesDirs
    classpath = sourceSets.test.get().runtimeClasspath
    useJUnitPlatform {
        includeTags("concurrency")
    }
}

// NFR-05: 포맷 검사. 확인은 ./gradlew spotlessCheck, 자동 정리는 ./gradlew spotlessApply
spotless {
    java {
        googleJavaFormat()
        removeUnusedImports()
    }
}
