package com.example.eduhub.auth.dev;

import com.example.eduhub.auth.domain.Employee;
import com.example.eduhub.auth.domain.Role;
import com.example.eduhub.auth.repository.EmployeeRepository;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * dev 프로필에서 개발용 계정을 만든다 (NFR-03, D-42). 비밀번호 값은 로그에 남기지 않는다.
 *
 * <p>동시 기동 시 유일 제약 위반은 건너뛴다(사번 유일 제약 uq_employee_employee_no가 최후 방어선).
 */
@Component
@Profile("dev")
public class DevAccountInitializer implements ApplicationRunner {

  /** bcrypt는 72바이트를 넘는 입력을 받지 않는다. */
  private static final int BCRYPT_MAX_BYTES = 72;

  private static final Logger log = LoggerFactory.getLogger(DevAccountInitializer.class);

  private final EmployeeRepository employeeRepository;
  private final PasswordEncoder passwordEncoder;
  private final String password;

  public DevAccountInitializer(
      EmployeeRepository employeeRepository,
      PasswordEncoder passwordEncoder,
      @Value("${eduhub.dev-accounts.password:}") String password) {
    this.employeeRepository = employeeRepository;
    this.passwordEncoder = passwordEncoder;
    this.password = password;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (password == null || password.isBlank()) {
      log.warn("EDUHUB_DEV_PASSWORD가 비어 있어 개발용 계정을 만들지 않는다");
      return;
    }
    if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
      log.warn("EDUHUB_DEV_PASSWORD가 UTF-8 {}바이트(bcrypt 제한)를 넘어 개발용 계정을 만들지 않는다", BCRYPT_MAX_BYTES);
      return;
    }
    create("DEV-E001", "개발사원1", Role.EMPLOYEE);
    create("DEV-E002", "개발사원2", Role.EMPLOYEE);
    create("DEV-A001", "개발관리자", Role.ADMIN);
  }

  private void create(String employeeNo, String name, Role role) {
    if (employeeRepository.existsByEmployeeNo(employeeNo)) {
      return;
    }
    try {
      employeeRepository.saveAndFlush(
          new Employee(employeeNo, name, passwordEncoder.encode(password), role));
      log.info("개발용 계정을 만들었다: {}", employeeNo);
    } catch (DataIntegrityViolationException e) {
      log.info("개발용 계정이 이미 있어 건너뛴다: {}", employeeNo);
    }
  }
}
