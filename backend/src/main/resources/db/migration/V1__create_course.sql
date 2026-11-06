-- 과정 (FR-01~03)
CREATE TABLE course (
    id          BIGINT IDENTITY(1, 1) NOT NULL,
    title       NVARCHAR(200)  NOT NULL,
    category    NVARCHAR(50)   NOT NULL,
    description NVARCHAR(2000) NULL,
    status      NVARCHAR(20)   NOT NULL,
    CONSTRAINT pk_course PRIMARY KEY (id)
);

-- 회차 (FR-02~03). status가 CLOSED면 모집 마감이다 (D-11)
-- start_date는 표시용 일정이며 취소·마감 판단에 쓰지 않는다 (D-02)
CREATE TABLE course_session (
    id         BIGINT IDENTITY(1, 1) NOT NULL,
    course_id  BIGINT        NOT NULL,
    start_date DATE          NOT NULL,
    place      NVARCHAR(200) NOT NULL,
    capacity   INT           NOT NULL,
    status     NVARCHAR(20)  NOT NULL,
    CONSTRAINT pk_course_session PRIMARY KEY (id),
    CONSTRAINT fk_course_session_course FOREIGN KEY (course_id) REFERENCES course (id),
    CONSTRAINT ck_course_session_capacity CHECK (capacity > 0)
);

-- SQL Server는 FK에 인덱스를 자동으로 만들지 않는다 (NFR-02: 과정별 회차 조회)
CREATE INDEX ix_course_session_course_id ON course_session (course_id);
