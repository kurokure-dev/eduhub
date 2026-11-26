package com.example.eduhub.auth.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

// 개발 DB(SQL Server)에 직접 연결한다 (D-15). 테스트가 끝나면 롤백된다.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ActiveProfiles("test")
class EmployeeRepositoryTest {

  @Autowired private EmployeeRepository employeeRepository;
  @Autowired private TestEntityManager em;

  private String employeeNo;

  @BeforeEach
  void setUp() {
    employeeNo = "T" + UUID.randomUUID().toString().substring(0, 8);
  }

  @Test
  @DisplayName("사원을 저장하고 사번으로 다시 조회한다 (D-42)")
  void saveAndFindByEmployeeNo() {
    employeeRepository.save(new Employee(employeeNo, "홍길동", "{bcrypt}hash", Role.EMPLOYEE));
    em.flush();
    em.clear();

    Employee found = employeeRepository.findByEmployeeNo(employeeNo).orElseThrow();

    assertThat(found.getId()).isNotNull();
    assertThat(found.getName()).isEqualTo("홍길동");
    assertThat(found.getPasswordHash()).isEqualTo("{bcrypt}hash");
    assertThat(found.getRole()).isEqualTo(Role.EMPLOYEE);
  }

  @Test
  @DisplayName("없는 사번은 빈 결과이고 existsByEmployeeNo는 존재 여부를 알려 준다")
  void existsByEmployeeNo() {
    assertThat(employeeRepository.existsByEmployeeNo(employeeNo)).isFalse();
    assertThat(employeeRepository.findByEmployeeNo(employeeNo)).isEmpty();

    employeeRepository.save(new Employee(employeeNo, "관리자", "{bcrypt}hash", Role.ADMIN));
    em.flush();

    assertThat(employeeRepository.existsByEmployeeNo(employeeNo)).isTrue();
  }

  @Test
  @DisplayName("같은 사번을 두 번 저장하면 유일 제약으로 거부된다 (NFR-03)")
  void duplicateEmployeeNoRejected() {
    employeeRepository.save(new Employee(employeeNo, "첫째", "{bcrypt}hash", Role.EMPLOYEE));
    em.flush();

    // IDENTITY 키라 save 시점에 INSERT가 나가므로 save와 flush를 함께 감싼다
    assertThatThrownBy(
            () -> {
              employeeRepository.save(
                  new Employee(employeeNo, "둘째", "{bcrypt}hash", Role.EMPLOYEE));
              em.flush();
            })
        .isInstanceOf(DataIntegrityViolationException.class);
  }
}
