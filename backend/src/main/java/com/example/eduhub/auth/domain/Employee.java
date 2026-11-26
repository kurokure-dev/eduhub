package com.example.eduhub.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 사원 계정 (NFR-03, D-42). 사번은 enrollment의 employee_id와 같은 값이다 (D-44). */
@Entity
@Table(name = "employee")
public class Employee {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "employee_no", nullable = false, length = 20)
  private String employeeNo;

  @Column(nullable = false, length = 50)
  private String name;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private Role role;

  protected Employee() {}

  public Employee(String employeeNo, String name, String passwordHash, Role role) {
    this.employeeNo = employeeNo;
    this.name = name;
    this.passwordHash = passwordHash;
    this.role = role;
  }

  public Long getId() {
    return id;
  }

  public String getEmployeeNo() {
    return employeeNo;
  }

  public String getName() {
    return name;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public Role getRole() {
    return role;
  }
}
