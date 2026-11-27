import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CompletionFailureReasonEnum,
  RosterConfirmedEntryStatusEnum,
  RosterResponseSessionStatusEnum,
} from '@eduhub/api-client';
import { CompleteError, useCompleteEnrollments } from '../hooks/useCompleteEnrollments';
import { useRoster } from '../hooks/useRoster';

const REASON_TEXT: Record<string, string> = {
  [CompletionFailureReasonEnum.Waiting]: '대기 중',
  [CompletionFailureReasonEnum.NotEnrolled]: '신청 내역 없음',
  [CompletionFailureReasonEnum.AlreadyCompleted]: '이미 수료',
};

interface Result {
  completed: number;
  // 처리 시점의 명단에서 이름을 찾아 만든 "이름(사번) — 사유" 문구
  failed: string[];
}

/**
 * 회차 명단과 수료 처리 (FR-08, D-10, D-13, D-55). 서버 데이터는 훅으로만 가져온다.
 * 회차가 바뀌면 선택·결과를 초기화하도록 sessionId를 key로 본문을 다시 만든다
 */
export default function RosterPage() {
  const { sessionId } = useParams();
  return <RosterBody key={sessionId} sessionId={sessionId} />;
}

// FR-08: 수료 요청 상한 (백엔드 @Size max=200)
const MAX_COMPLETE = 200;

function RosterBody({ sessionId }: { sessionId: string | undefined }) {
  const { data, loading, error, notFound, reload } = useRoster(sessionId);
  const { complete, pending } = useCompleteEnrollments();
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result>();
  const [failure, setFailure] = useState<string>();

  // 수료 결과·실패 안내는 다시 읽기가 실패해도 남긴다 (FR-08)
  const resultAlerts = (
    <>
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFailure(undefined)}>
          {failure}
        </Alert>
      )}
      {result && (
        <Alert
          severity={result.failed.length > 0 ? 'warning' : 'success'}
          sx={{ mb: 2 }}
          onClose={() => setResult(undefined)}
        >
          {`${result.completed}명을 수료 처리했습니다.`}
          {result.failed.length > 0 && (
            <ul style={{ margin: 0 }}>
              {result.failed.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
    </>
  );

  if (loading && data === undefined) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }
  if (notFound) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">회차를 찾을 수 없습니다</Alert>
      </Container>
    );
  }
  if (error?.kind === 'forbidden') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {resultAlerts}
        <Alert severity="error">관리자만 볼 수 있습니다.</Alert>
      </Container>
    );
  }
  if (error || !data) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        {resultAlerts}
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={reload}>
              다시 시도
            </Button>
          }
        >
          명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </Alert>
      </Container>
    );
  }

  const confirmed = data.confirmed ?? [];
  const waiting = [...(data.waiting ?? [])].sort((a, b) => (a.waitingRank ?? 0) - (b.waitingRank ?? 0));
  const selectable = confirmed
    .filter((c) => c.status === RosterConfirmedEntryStatusEnum.Confirmed && c.employeeNo)
    .map((c) => c.employeeNo as string);
  // 다시 읽은 뒤 현재 CONFIRMED가 아닌 사번은 선택에서 뺀다 (개수·전송·전체 선택 모두 이 값을 쓴다)
  const active = selected.filter((no) => selectable.includes(no));
  const allSelected = selectable.length > 0 && selectable.every((no) => active.includes(no));
  const someSelected = active.length > 0 && !allSelected;
  const overLimit = active.length > MAX_COMPLETE;

  const toggle = (no: string) => setSelected(active.includes(no) ? active.filter((x) => x !== no) : [...active, no]);

  const handleComplete = async () => {
    if (data.sessionId === undefined) return;
    setResult(undefined);
    setFailure(undefined);
    try {
      const response = await complete(data.sessionId, active);
      const nameOf = (no?: string) =>
        [...confirmed, ...waiting].find((p) => p.employeeNo === no)?.name;
      setResult({
        completed: (response.completed ?? []).length,
        failed: (response.failed ?? []).map((f) => {
          const name = nameOf(f.employeeId);
          const who = name ? `${name}(${f.employeeId})` : `${f.employeeId}`;
          return `${who} — ${f.reason ? (REASON_TEXT[f.reason] ?? f.reason) : '처리하지 못했습니다'}`;
        }),
      });
      setSelected([]);
    } catch (e: unknown) {
      const kind = e instanceof CompleteError ? e.kind : 'error';
      const detail = e instanceof CompleteError ? e.detail : undefined;
      if (kind === 'conflict' && detail) setFailure(detail);
      else if (kind === 'forbidden') setFailure('관리자만 볼 수 있습니다.');
      else if (kind === 'notFound') setFailure('회차를 찾을 수 없습니다');
      else setFailure(detail ?? '수료 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
    // 성공이든 실패든 서버 상태가 바뀌었을 수 있으니 다시 읽는다
    reload();
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {data.courseTitle}
      </Typography>
      <Typography sx={{ mb: 2 }}>
        시작일 {data.sessionStartDate} · 정원 {data.capacity}명 ·{' '}
        {data.sessionStatus === RosterResponseSessionStatusEnum.Closed ? '마감' : '모집 중'}
      </Typography>

      {resultAlerts}

      <Typography variant="h6" component="h2" gutterBottom>
        확정자
      </Typography>
      <Paper sx={{ mb: 2 }}>
        <TableContainer>
          <Table aria-label="확정자">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectable.length === 0 || pending}
                    onChange={() => setSelected(allSelected ? [] : selectable)}
                    slotProps={{ input: { 'aria-label': '전체 선택' } }}
                  />
                </TableCell>
                <TableCell>이름</TableCell>
                <TableCell>사번</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {confirmed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    확정자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                confirmed.map((c) => (
                  <TableRow key={c.enrollmentId ?? c.employeeNo}>
                    <TableCell padding="checkbox">
                      {c.status === RosterConfirmedEntryStatusEnum.Confirmed && c.employeeNo ? (
                        <Checkbox
                          checked={active.includes(c.employeeNo)}
                          disabled={pending}
                          onChange={() => toggle(c.employeeNo as string)}
                          slotProps={{ input: { 'aria-label': `${c.name ?? c.employeeNo} 선택` } }}
                        />
                      ) : c.status === RosterConfirmedEntryStatusEnum.Completed ? (
                        <Chip label="수료" size="small" color="success" />
                      ) : null}
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.employeeNo}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {overLimit && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {`한 번에 최대 ${MAX_COMPLETE}명까지 수료 처리할 수 있습니다. 선택을 줄여 주세요.`}
        </Alert>
      )}
      <Button
        variant="contained"
        sx={{ mb: 4 }}
        disabled={active.length === 0 || overLimit || pending}
        onClick={handleComplete}
      >
        {`선택한 ${active.length}명 수료 처리`}
      </Button>

      <Typography variant="h6" component="h2" gutterBottom>
        대기자
      </Typography>
      <Paper>
        <TableContainer>
          <Table aria-label="대기자">
            <TableHead>
              <TableRow>
                <TableCell>순번</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>사번</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waiting.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    대기자가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                waiting.map((w) => (
                  <TableRow key={w.enrollmentId ?? w.employeeNo}>
                    <TableCell>{w.waitingRank}</TableCell>
                    <TableCell>{w.name}</TableCell>
                    <TableCell>{w.employeeNo}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
}
