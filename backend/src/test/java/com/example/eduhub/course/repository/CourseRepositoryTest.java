package com.example.eduhub.course.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.eduhub.course.domain.Course;
import com.example.eduhub.course.domain.CourseSession;
import com.example.eduhub.course.domain.CourseSessionStatus;
import com.example.eduhub.course.domain.CourseStatus;
import java.time.LocalDate;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

// 개발 DB(SQL Server)에 직접 연결한다 (D-15). 테스트가 끝나면 롤백된다
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class CourseRepositoryTest {

  @Autowired private CourseRepository courseRepository;
  @Autowired private TestEntityManager em;

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
}
