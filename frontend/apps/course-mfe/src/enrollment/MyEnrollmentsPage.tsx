import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { FindMineStatusEnum, MyEnrollmentResponseStatusEnum } from '@eduhub/api-client';
import type { MyEnrollmentResponse } from '@eduhub/api-client';
import { CancelError, useCancelEnrollment } from '../hooks/useCancelEnrollment';
import { useMyEnrollments } from '../hooks/useMyEnrollments';
import StatusChip from './StatusChip';

type Filter = FindMineStatusEnum | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: FindMineStatusEnum.Confirmed, label: '확정' },
  { value: FindMineStatusEnum.Waiting, label: '대기' },
  { value: FindMineStatusEnum.Cancelled, label: '취소' },
  { value: FindMineStatusEnum.Completed, label: '수료' },
];

const CANCEL_ERROR_TEXT = {
  conflict: '마감되었거나 취소할 수 없는 신청입니다',
  notFound: '신청을 찾을 수 없습니다',
  error: '취소 중 오류가 발생했습니다',
} as const;

const COLUMNS = 5;

/** 내 신청 내역과 취소 (FR-06, D-09). 서버 데이터는 훅으로만 가져온다 */
export default function MyEnrollmentsPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, loading, error, reload } = useMyEnrollments(filter === 'ALL' ? undefined : filter);
  const { cancel, pending } = useCancelEnrollment();
  const [target, setTarget] = useState<MyEnrollmentResponse>();
  const [notice, setNotice] = useState<{ severity: 'success' | 'error'; text: string }>();

  const rows = data ?? [];

  const handleConfirm = async () => {
    if (!target || target.enrollmentId === undefined) return;
    const enrollmentId = target.enrollmentId;
    // 요청이 끝날 때까지 대화상자를 열어 두어 같은 행을 다시 취소하지 못하게 한다 (D-52)
    try {
      await cancel(enrollmentId);
      setNotice({ severity: 'success', text: '신청이 취소되었습니다' });
    } catch (e: unknown) {
      setNotice({ severity: 'error', text: CANCEL_ERROR_TEXT[e instanceof CancelError ? e.kind : 'error'] });
    }
    setTarget(undefined);
    // 성공이든 실패든 서버 상태가 바뀌었을 수 있으니 다시 읽는다 (D-01)
    reload();
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        내 신청 내역
      </Typography>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, next: Filter | null) => {
          if (!next) return;
          setFilter(next);
          setNotice(undefined); // 필터를 바꾸면 이전 안내를 지운다
        }}
        aria-label="상태 필터"
        sx={{ mb: 2 }}
      >
        {FILTERS.map((f) => (
          <ToggleButton key={f.value} value={f.value}>
            {f.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(undefined)}>
          {notice.text}
        </Alert>
      )}

      {error ? (
        <Alert severity="error">신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>
      ) : loading && data === undefined ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table aria-label="내 신청 내역">
              <TableHead>
                <TableRow>
                  <TableCell>과정</TableCell>
                  <TableCell>시작일</TableCell>
                  <TableCell>장소</TableCell>
                  <TableCell>상태</TableCell>
                  <TableCell align="center">취소</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={COLUMNS} align="center">
                      신청 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.enrollmentId}>
                      <TableCell>{row.courseTitle}</TableCell>
                      <TableCell>{row.sessionStartDate}</TableCell>
                      <TableCell>{row.sessionPlace}</TableCell>
                      <TableCell>
                        <StatusChip status={row.status} waitingRank={row.waitingRank} />
                      </TableCell>
                      <TableCell align="center">
                        {(row.status === MyEnrollmentResponseStatusEnum.Confirmed ||
                          row.status === MyEnrollmentResponseStatusEnum.Waiting) && (
                          <Button
                            size="small"
                            color="error"
                            aria-label={`${row.courseTitle} 신청 취소`}
                            disabled={pending}
                            onClick={() => setTarget(row)}
                          >
                            취소
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={target !== undefined} onClose={() => !pending && setTarget(undefined)}>
        <DialogTitle>신청을 취소할까요?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {target?.courseTitle} ({target?.sessionStartDate})
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={pending} onClick={() => setTarget(undefined)}>
            닫기
          </Button>
          <Button color="error" disabled={pending} onClick={handleConfirm}>
            취소 확정
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
