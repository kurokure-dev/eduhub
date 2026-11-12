-- D-37: 회차 확정 인원. 회차 행 락 안에서만 바꾼다 (D-29)
ALTER TABLE course_session
    ADD confirmed_count INT NOT NULL
        CONSTRAINT df_course_session_confirmed_count DEFAULT 0;
GO
-- 새 컬럼을 같은 배치에서 참조하면 컴파일 오류가 나므로 배치를 나눈다

-- NFR-01: 정원 초과의 마지막 방어선
ALTER TABLE course_session
    ADD CONSTRAINT ck_course_session_confirmed_count
        CHECK (confirmed_count >= 0 AND confirmed_count <= capacity);

-- 수강 신청 (FR-04~08). 상태: CONFIRMED, WAITING, CANCELLED, COMPLETED
CREATE TABLE enrollment (
    id            BIGINT IDENTITY(1, 1) NOT NULL,
    session_id    BIGINT       NOT NULL,
    employee_id   NVARCHAR(20) NOT NULL,
    status        NVARCHAR(20) NOT NULL,
    waiting_order BIGINT       NULL,      -- D-39: 대기 정렬 키. FR-05에서 채운다
    applied_at    DATETIME2(6) NOT NULL,
    CONSTRAINT pk_enrollment PRIMARY KEY (id),
    CONSTRAINT fk_enrollment_session FOREIGN KEY (session_id) REFERENCES course_session (id),
    CONSTRAINT ck_enrollment_status
        CHECK (status IN ('CONFIRMED', 'WAITING', 'CANCELLED', 'COMPLETED')),
    -- 대기가 아니면 정렬 키가 없다. FR-05에서 "WAITING이면 NOT NULL"로 강화한다
    CONSTRAINT ck_enrollment_waiting_order
        CHECK (status = 'WAITING' OR waiting_order IS NULL)
);

-- FR-04, D-07: 같은 회차에 확정·대기 신청은 한 사람당 하나. 취소·수료 뒤 재신청은 허용
CREATE UNIQUE INDEX ux_enrollment_active
    ON enrollment (session_id, employee_id)
    WHERE status IN ('CONFIRMED', 'WAITING');

-- D-39: 회차 안에서 대기 정렬 키는 유일하다. NULL 행은 필터에서 빠진다
CREATE UNIQUE INDEX ux_enrollment_waiting_order
    ON enrollment (session_id, waiting_order)
    WHERE waiting_order IS NOT NULL;

-- NFR-02: SQL Server는 FK 인덱스를 만들지 않는다
CREATE INDEX ix_enrollment_session_id ON enrollment (session_id);
-- NFR-02: FR-07 내 신청 내역 조회 대비
CREATE INDEX ix_enrollment_employee_id ON enrollment (employee_id);
