package com.example.eduhub.auth.repository;

import com.example.eduhub.auth.domain.Employee;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

  Optional<Employee> findByEmployeeNo(String employeeNo);

  boolean existsByEmployeeNo(String employeeNo);
}
