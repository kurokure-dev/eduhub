package com.example.eduhub.course.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStatus;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;

// 개발 DB(SQL Server)에 직접 연결한다 (D-15). 테스트가 끝나면 롤백된다.
// 개발 DB에 다른 데이터가 있을 수 있으므로 검색 테스트는 테스트마다 고유한 분류값으로 결과를 좁힌다
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CourseRepositoryTest {

  @Autowired private CourseRepository courseRepository;
  @Autowired private TestEntityManager em;

  private String category;

  @BeforeEach
  void setUp() {
    category = "T-" + UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  @DisplayName("과정과 회차를 저장하고 다시 조회할 수 있다")
  void saveAndFind() {
    Course course = courseRepository.save(new Course("Spring 입문", "개발", "Spring Boot 기초 과정"));
    CourseSession session =
        em.persist(new CourseSession(course, LocalDate.of(2026, 12, 1), "본사 3층 교육장", 20));
    em.flush();
    em.clear();

    CourseSession foundSession = em.find(CourseSession.class, session.getId());
    assertThat(foundSession.getPlace()).isEqualTo("본사 3층 교육장");
    assertThat(foundSession.getStartDate()).isEqualTo(LocalDate.of(2026, 12, 1));
    assertThat(foundSession.getCapacity()).isEqualTo(20);
    assertThat(foundSession.getStatus()).isEqualTo(CourseSessionStatus.OPEN);
    // N:1은 LAZY라서 회차만 조회하면 과정은 아직 불러오지 않는다
    assertThat(Hibernate.isInitialized(foundSession.getCourse())).isFalse();

    Course foundCourse = courseRepository.findById(course.getId()).orElseThrow();
    assertThat(foundCourse.getTitle()).isEqualTo("Spring 입문");
    assertThat(foundCourse.getCategory()).isEqualTo("개발");
    assertThat(foundCourse.getStatus()).isEqualTo(CourseStatus.OPEN);
  }

  @Test
  @DisplayName("제목은 부분 일치로 검색한다")
  void searchByTitleKeyword() {
    courseRepository.save(new Course("Spring 입문", category, null));
    courseRepository.save(new Course("JPA 심화", category, null));

    Page<Course> result =
        courseRepository.search(CourseStatus.OPEN, "입문", category, PageRequest.of(0, 10));

    assertThat(result.getContent()).extracting(Course::getTitle).containsExactly("Spring 입문");
  }

  @Test
  @DisplayName("분류는 정확히 일치하는 것만 검색한다")
  void searchByCategoryExactly() {
    courseRepository.save(new Course("Spring 입문", category, null));
    courseRepository.save(new Course("JPA 심화", category + "X", null));

    Page<Course> result =
        courseRepository.search(CourseStatus.OPEN, null, category, PageRequest.of(0, 10));

    assertThat(result.getContent()).extracting(Course::getTitle).containsExactly("Spring 입문");
  }

  @Test
  @DisplayName("종료된 과정은 검색 결과에서 빠진다 (D-17)")
  void excludeClosedCourses() {
    courseRepository.save(new Course("Spring 입문", category, null));
    Course closed = new Course("JPA 심화", category, null);
    closed.close();
    courseRepository.save(closed);

    Page<Course> result =
        courseRepository.search(CourseStatus.OPEN, null, category, PageRequest.of(0, 10));

    assertThat(result.getContent()).extracting(Course::getTitle).containsExactly("Spring 입문");
  }

  @Test
  @DisplayName("요청한 정렬과 페이지 크기로 나누고 전체 건수를 알려 준다 (D-18)")
  void pageAndSort() {
    Course b = courseRepository.save(new Course("B 과정", category, null));
    Course a = courseRepository.save(new Course("A 과정", category, null));
    Course c = courseRepository.save(new Course("C 과정", category, null));

    Page<Course> byIdDesc =
        courseRepository.search(
            CourseStatus.OPEN, null, category, PageRequest.of(0, 2, Sort.by("id").descending()));
    assertThat(byIdDesc.getContent()).containsExactly(c, a);
    assertThat(byIdDesc.getTotalElements()).isEqualTo(3);
    assertThat(byIdDesc.getTotalPages()).isEqualTo(2);

    Page<Course> byTitleAsc =
        courseRepository.search(
            CourseStatus.OPEN, null, category, PageRequest.of(0, 10, Sort.by("title")));
    assertThat(byTitleAsc.getContent()).containsExactly(a, b, c);
  }

  @Test
  @DisplayName("과정의 모집 중인 회차만 일정순으로 조회한다 (D-19, D-21)")
  void findOpenSessionsInDateOrder(@Autowired CourseSessionRepository sessionRepository) {
    Course course = courseRepository.save(new Course("Spring 입문", category, null));
    CourseSession later =
        em.persist(new CourseSession(course, LocalDate.of(2026, 12, 10), "본사", 20));
    CourseSession earlier =
        em.persist(new CourseSession(course, LocalDate.of(2026, 12, 1), "본사", 20));
    CourseSession closed = new CourseSession(course, LocalDate.of(2026, 11, 20), "본사", 20);
    closed.close();
    em.persist(closed);

    assertThat(
            sessionRepository.findByCourseIdAndStatusOrderByStartDateAscIdAsc(
                course.getId(), CourseSessionStatus.OPEN))
        .containsExactly(earlier, later);
  }

  @Test
  @DisplayName("분류 목록은 종료되지 않은 과정의 분류를 중복 없이 이름순으로 돌려준다 (D-23)")
  void findCategories() {
    String first = category + "-A";
    String second = category + "-B";
    String closedOnly = category + "-C";
    courseRepository.save(new Course("과정 1", second, null));
    courseRepository.save(new Course("과정 2", first, null));
    courseRepository.save(new Course("과정 3", first, null));
    Course closed = new Course("과정 4", closedOnly, null);
    closed.close();
    courseRepository.save(closed);

    // 개발 DB의 다른 분류가 섞여 있을 수 있으므로 이 테스트의 분류만 골라 확인한다
    assertThat(courseRepository.findCategories(CourseStatus.OPEN))
        .filteredOn(name -> name.startsWith(category))
        .containsExactly(first, second);
  }
}
