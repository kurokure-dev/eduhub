-- NFR-03, D-42: 사원 계정. 회원가입은 없고 dev 프로필에서만 개발용 계정을 만든다
CREATE TABLE employee (
    id            BIGINT IDENTITY(1, 1) NOT NULL,
    employee_no   NVARCHAR(20)  NOT NULL,   -- 사번. enrollment.employee_id와 같은 값 (D-44)
    name          NVARCHAR(50)  NOT NULL,
    password_hash NVARCHAR(100) NOT NULL,   -- {bcrypt}... (DelegatingPasswordEncoder)
    role          NVARCHAR(20)  NOT NULL,
    CONSTRAINT pk_employee PRIMARY KEY (id),
    -- NFR-03: 사번 중복은 DB 유일 제약으로 막는다
    CONSTRAINT uq_employee_employee_no UNIQUE (employee_no),
    CONSTRAINT ck_employee_role CHECK (role IN ('EMPLOYEE', 'ADMIN'))
);
