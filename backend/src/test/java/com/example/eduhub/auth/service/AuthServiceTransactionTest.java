package com.example.eduhub.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.repository.EmployeeRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** login()은 트랜잭션 밖에서 돌아야 한다 (NFR-01, NFR-03). 테스트 메서드에 @Transactional을 붙이면 의미가 없어지므로 사원은 직접 지운다. */
@SpringBootTest
@ActiveProfiles("test")
class AuthServiceTransactionTest {

  @Autowired private AuthService authService;
  @Autowired private EmployeeRepository employeeRepository;
  @MockitoSpyBean private PasswordEncoder passwordEncoder;

  private Employee saved;

  @AfterEach
  void cleanUp() {
    if (saved != null) {
      employeeRepository.deleteById(saved.getId());
    }
  }

  @Test
  @DisplayName("NFR-03 login()의 bcrypt 검증은 트랜잭션 밖에서 실행된다")
  void passwordMatchesRunsOutsideTransaction() {
    String password = UUID.randomUUID().toString();
    String no = "T-" + UUID.randomUUID().toString().substring(0, 8);
    saved =
        employeeRepository.save(
            new Employee(no, "트랜잭션테스트", passwordEncoder.encode(password), Role.EMPLOYEE));

    List<Boolean> active = new ArrayList<>();
    doAnswer(
            inv -> {
              active.add(TransactionSynchronizationManager.isActualTransactionActive());
              return inv.callRealMethod();
            })
        .when(passwordEncoder)
        .matches(any(), any());

    authService.login(no, password);

    assertThat(active).isNotEmpty().containsOnly(false);
  }
}
