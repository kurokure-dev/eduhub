package com.example.eduhub.course.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

// 관리자 조회용 쿼리 (FR-03, D-34). 개발 DB에 직접 연결하고 롤백한다 (D-15).
// 다른 데이터와 섞이지 않도록 테스트마다 고유한 분류값으로 결과를 좁힌다
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class AdminCourseRepositoryTest {

  @Autowired private CourseRepository courseRepository;
  @Autowired private CourseSessionRepository courseSessionRepository;

  private String category;

  @BeforeEach
  void setUp() {
    category = "T-" + UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  @DisplayName("상태 조건이 없으면 종료된 과정도 함께 조회한다")
  void adminSearchIncludesClosed() {
    Course open = courseRepository.save(new Course("Spring 입문", category, null));
    Course closed = new Course("JPA 심화", category, null);
    closed.close();
    courseRepository.save(closed);

    Page<Course> all =
        courseRepository.adminSearch(
            null, null, category, PageRequest.of(0, 10, Sort.by("id").ascending()));
    assertThat(all.getContent()).containsExactly(open, closed);

    Page<Course> onlyClosed =
        courseRepository.adminSearch(CourseStatus.CLOSED, null, category, PageRequest.of(0, 10));
    assertThat(onlyClosed.getContent()).containsExactly(closed);
  }

  @Test
  @DisplayName("제목 부분 일치 조건을 적용한다")
  void adminSearchByKeyword() {
    courseRepository.save(new Course("Spring 입문", category, null));
    courseRepository.save(new Course("JPA 심화", category, null));

    Page<Course> result = courseRepository.adminSearch(null, "심화", category, PageRequest.of(0, 10));

    assertThat(result.getContent()).extracting(Course::getTitle).containsExactly("JPA 심화");
  }

  @Test
  @DisplayName("과정의 모든 회차를 상태와 관계없이 일정순으로 조회한다")
  void findAllSessionsOfCourse() {
    Course course = courseRepository.save(new Course("Spring 입문", category, null));
    CourseSession later =
        courseSessionRepository.save(
            new CourseSession(course, LocalDate.of(2026, 12, 8), "본사", 20));
    CourseSession earlier = new CourseSession(course, LocalDate.of(2026, 12, 1), "본사", 20);
    earlier.close();
    courseSessionRepository.save(earlier);

    List<CourseSession> sessions =
        courseSessionRepository.findByCourseIdOrderByStartDateAscIdAsc(course.getId());

    assertThat(sessions).containsExactly(earlier, later);
  }

  @Test
  @DisplayName("다른 과정의 회차 id로는 찾을 수 없다")
  void findByIdAndCourseId() {
    Course course = courseRepository.save(new Course("Spring 입문", category, null));
    Course other = courseRepository.save(new Course("JPA 심화", category, null));
    CourseSession session =
        courseSessionRepository.save(
            new CourseSession(course, LocalDate.of(2026, 12, 1), "본사", 20));

    assertThat(courseSessionRepository.findByIdAndCourseId(session.getId(), course.getId()))
        .contains(session);
    assertThat(courseSessionRepository.findByIdAndCourseId(session.getId(), other.getId()))
        .isEmpty();
  }
}
