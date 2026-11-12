package com.example.eduhub.course.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

// 회차 행 락 조회 (D-29). 개발 DB에 직접 연결하고 롤백한다 (D-15).
// 실행 SQL에 updlock 힌트가 나가는지는 SQL 로그(org.hibernate.SQL: debug)에서 사람이 확인한다 (R7)
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CourseSessionLockRepositoryTest {

  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository sessionRepository;
  @Autowired private EntityManager entityManager;

  private Course course;
  private Course other;
  private CourseSession first;
  private CourseSession second;
  private CourseSession closed;

  @BeforeEach
  void setUp() {
    String category = "T-" + UUID.randomUUID().toString().substring(0, 8);
    course = courseRepository.save(new Course("Spring 입문", category, null));
    other = courseRepository.save(new Course("JPA 심화", category, null));
    first = sessionRepository.save(new CourseSession(course, LocalDate.of(2026, 12, 8), "본사", 20));
    second = sessionRepository.save(new CourseSession(course, LocalDate.of(2026, 12, 1), "본사", 20));
    CourseSession toClose = new CourseSession(course, LocalDate.of(2026, 12, 15), "본사", 20);
    toClose.close();
    closed = sessionRepository.save(toClose);
    entityManager.flush();
    entityManager.clear();
  }

  @Test
  @DisplayName("id로 회차를 락을 잡고 조회한다 (D-29)")
  void findByIdForUpdate() {
    assertThat(sessionRepository.findByIdForUpdate(first.getId()))
        .get()
        .extracting(CourseSession::getId)
        .isEqualTo(first.getId());
    assertThat(sessionRepository.findByIdForUpdate(-1L)).isEmpty();
  }

  @Test
  @DisplayName("과정 id가 맞을 때만 회차를 락을 잡고 조회한다 (D-29)")
  void findByIdAndCourseIdForUpdate() {
    assertThat(sessionRepository.findByIdAndCourseIdForUpdate(first.getId(), course.getId()))
        .get()
        .extracting(CourseSession::getId)
        .isEqualTo(first.getId());

    entityManager.clear();

    assertThat(sessionRepository.findByIdAndCourseIdForUpdate(first.getId(), other.getId()))
        .isEmpty();
  }

  @Test
  @DisplayName("과정의 OPEN 회차만 id 순서로 락을 잡고 조회한다 (D-29)")
  void findByCourseIdAndStatusForUpdate() {
    List<CourseSession> open =
        sessionRepository.findByCourseIdAndStatusForUpdate(
            course.getId(), CourseSessionStatus.OPEN);

    assertThat(open)
        .extracting(CourseSession::getId)
        .containsExactly(first.getId(), second.getId());
    assertThat(open).extracting(CourseSession::getId).doesNotContain(closed.getId());
    assertThat(
            sessionRepository.findByCourseIdAndStatusForUpdate(
                other.getId(), CourseSessionStatus.OPEN))
        .isEmpty();
  }
}
