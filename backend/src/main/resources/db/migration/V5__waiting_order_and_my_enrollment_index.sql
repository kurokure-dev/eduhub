-- D-39, D-46: 기존 대기 신청에 회차별 (applied_at, id) 순서로 정렬 키를 채운다
WITH ordered AS (
    SELECT waiting_order,
           ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY applied_at, id) AS rn
    FROM enrollment
    WHERE status = 'WAITING'
)
UPDATE ordered SET waiting_order = rn;

-- D-39: 대기면 정렬 키가 반드시 있고, 대기가 아니면 없다 (V2 제약 강화)
ALTER TABLE enrollment DROP CONSTRAINT ck_enrollment_waiting_order;
ALTER TABLE enrollment ADD CONSTRAINT ck_enrollment_waiting_order
    CHECK ((status = 'WAITING' AND waiting_order IS NOT NULL)
        OR (status <> 'WAITING' AND waiting_order IS NULL));

-- NFR-02, FR-07: 내 신청 조회. 사번 검색과 최근 신청순 정렬을 인덱스 하나로 끝낸다
CREATE INDEX ix_enrollment_employee_applied
    ON enrollment (employee_id, applied_at DESC, id DESC)
    INCLUDE (session_id, status, waiting_order);

-- 새 인덱스의 앞부분(employee_id)과 겹친다
DROP INDEX ix_enrollment_employee_id ON enrollment;
