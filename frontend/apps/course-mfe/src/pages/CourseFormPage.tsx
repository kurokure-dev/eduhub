import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminActionError, useAdminCourseActions } from '../hooks/useAdminCourseActions';
import { useCourseDetail } from '../hooks/useCourseDetail';

// D-55: 입력 검증은 admin-mfe·백엔드와 같다
const MAX_TITLE = 200;
const MAX_CATEGORY = 50;
const MAX_DESCRIPTION = 2000;
const MAX_PLACE = 200;

// retry: 화면 갱신 실패 안내. 다시 시도 버튼을 함께 보여 준다 (FR-03)
type Notice = { severity: 'success' | 'error' | 'warning'; text: string; retry?: boolean };

/** 서버 detail이 있으면 그대로, 없으면 종류별 일반 문구 (D-55) */
function errorNotice(e: unknown, fallback: string): Notice {
  if (e instanceof AdminActionError) {
    if (e.detail) return { severity: 'error', text: e.detail };
    if (e.kind === 'forbidden') return { severity: 'error', text: '관리자만 볼 수 있습니다.' };
    if (e.kind === 'notFound') return { severity: 'error', text: '과정을 찾을 수 없습니다' };
  }
  return { severity: 'error', text: fallback };
}

/** 과정 등록·수정·종료와 회차 추가 (FR-03, D-55). courseId가 없으면 등록, 있으면 수정 */
export default function CourseFormPage() {
  const { courseId } = useParams();
  const editing = courseId !== undefined;
  const navigate = useNavigate();
  const { initializing } = useAuth();
  const { data, loading, notFound, error, refresh } = useCourseDetail(courseId, {
    admin: true,
    enabled: !initializing && editing,
  });
  const { createCourse, updateCourse, closeCourse, createSession, pending } = useAdminCourseActions();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  // 로드된 과정 id. 같은 과정은 한 번만 폼을 채워 입력 중 refresh가 덮지 않게 한다
  const [filledId, setFilledId] = useState<number>();
  const [notice, setNotice] = useState<Notice>();

  const [startDate, setStartDate] = useState('');
  const [place, setPlace] = useState('');
  const [capacity, setCapacity] = useState('');
  const [sessionNotice, setSessionNotice] = useState<Notice>();
  const [closeOpen, setCloseOpen] = useState(false);
  // 오류 화면의 "다시 시도" 진행 중·실패 (누른 뒤 반응이 보이게 한다)
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    setRetryFailed(false);
    const ok = await refresh();
    setRetrying(false);
    if (!ok) setRetryFailed(true);
  };

  // 종료 요청이 성공하면 refresh 결과와 무관하게 바로 종료 상태로 잠근다
  const [closedLocal, setClosedLocal] = useState(false);

  useEffect(() => {
    if (!editing) {
      // 수정 → 등록으로 바뀌면 이전 과정의 값·안내·회차 입력을 모두 비운다 (중복 등록 방지)
      setFilledId(undefined);
      setTitle('');
      setCategory('');
      setDescription('');
      setNotice(undefined);
      setSessionNotice(undefined);
      setStartDate('');
      setPlace('');
      setCapacity('');
      setCloseOpen(false);
      setClosedLocal(false);
      return;
    }
    if (data && data.id !== filledId) {
      setTitle(data.title);
      setCategory(data.category);
      setDescription(data.description);
      setFilledId(data.id);
      setNotice(undefined);
      setSessionNotice(undefined);
      setClosedLocal(false);
    }
  }, [editing, data, filledId]);

  const closed = editing && (data?.closed === true || closedLocal);
  const locked = closed || pending;

  const courseValid =
    title.trim() !== '' &&
    title.length <= MAX_TITLE &&
    category.trim() !== '' &&
    category.length <= MAX_CATEGORY &&
    description.length <= MAX_DESCRIPTION;

  const capacityNumber = /^\d+$/.test(capacity) ? Number(capacity) : NaN;
  const sessionValid =
    startDate !== '' &&
    place.trim() !== '' &&
    place.length <= MAX_PLACE &&
    Number.isSafeInteger(capacityNumber) &&
    capacityNumber >= 1;

  // 설명은 비면 보내지 않는다 (admin-mfe와 같다)
  const request = () => ({ title: title.trim(), category: category.trim(), description: description.trim() || undefined });

  const handleCreate = async () => {
    setNotice(undefined);
    try {
      const created = await createCourse(request());
      if (created.id !== undefined) navigate(`/admin/courses/${created.id}/edit`, { replace: true });
    } catch (e: unknown) {
      setNotice(errorNotice(e, '과정을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setNotice(undefined);
    try {
      await updateCourse(data.id, request());
      setNotice({ severity: 'success', text: '저장되었습니다' });
      if (!(await refresh())) {
        setNotice({ severity: 'warning', text: '저장했지만 화면을 갱신하지 못했습니다', retry: true });
      }
    } catch (e: unknown) {
      setNotice(errorNotice(e, '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
  };

  const handleAddSession = async () => {
    if (!data) return;
    setSessionNotice(undefined);
    try {
      await createSession(data.id, { startDate, place: place.trim(), capacity: capacityNumber });
      setStartDate('');
      setPlace('');
      setCapacity('');
      if (!(await refresh())) {
        setSessionNotice({ severity: 'warning', text: '회차를 추가했지만 목록을 갱신하지 못했습니다', retry: true });
      }
    } catch (e: unknown) {
      setSessionNotice(errorNotice(e, '회차를 추가하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
  };

  const handleClose = async () => {
    if (!data) return;
    // 요청이 끝날 때까지 대화상자를 열어 두어 다시 누르지 못하게 한다
    let succeeded = false;
    try {
      await closeCourse(data.id);
      succeeded = true;
      setClosedLocal(true);
      setNotice(undefined);
    } catch (e: unknown) {
      setNotice(errorNotice(e, '과정을 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
    setCloseOpen(false);
    // 성공이든 실패든 서버 상태가 바뀌었을 수 있으니 다시 읽는다
    const refreshed = await refresh();
    if (succeeded && !refreshed) {
      setNotice({ severity: 'warning', text: '과정을 종료했지만 화면을 갱신하지 못했습니다', retry: true });
    }
  };

  const courseFields = (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <TextField
        label="제목"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={locked}
        error={title.length > MAX_TITLE}
        helperText={title.length > MAX_TITLE ? `${MAX_TITLE}자 이하로 입력해 주세요` : undefined}
      />
      <TextField
        label="분류"
        required
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={locked}
        error={category.length > MAX_CATEGORY}
        helperText={category.length > MAX_CATEGORY ? `${MAX_CATEGORY}자 이하로 입력해 주세요` : undefined}
      />
      <TextField
        label="설명"
        multiline
        minRows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={locked}
        error={description.length > MAX_DESCRIPTION}
        helperText={description.length > MAX_DESCRIPTION ? `${MAX_DESCRIPTION}자 이하로 입력해 주세요` : undefined}
      />
    </Stack>
  );

  const noticeAlert = (n: Notice | undefined, clear: () => void) =>
    n && (
      <Alert
        severity={n.severity}
        sx={{ mb: 2 }}
        onClose={clear}
        action={
          n.retry ? (
            <Button
              color="inherit"
              size="small"
              onClick={async () => {
                // 갱신에 성공하면 안내를 닫는다
                if (await refresh()) clear();
              }}
            >
              다시 시도
            </Button>
          ) : undefined
        }
      >
        {n.text}
      </Alert>
    );

  if (!editing) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          과정 등록
        </Typography>
        {noticeAlert(notice, () => setNotice(undefined))}
        {courseFields}
        <Button variant="contained" disabled={!courseValid || pending} onClick={handleCreate}>
          등록
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {loading || initializing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : notFound ? (
        <Alert severity="info">과정을 찾을 수 없습니다</Alert>
      ) : error || !data ? (
        <>
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" disabled={retrying} onClick={() => void handleRetry()}>
                {retrying ? '다시 불러오는 중' : '다시 시도'}
              </Button>
            }
          >
            {retryFailed
              ? '다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
              : '과정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
          </Alert>
        </>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h1">
              과정 수정
            </Typography>
            {closed ? (
              // 종료된 과정은 공개 상세가 404이므로 링크를 숨긴다 (D-54)
              <Chip label="종료" size="small" />
            ) : (
              <Link component={RouterLink} to={`/courses/${data.id}`} underline="hover" sx={{ ml: 'auto' }}>
                과정 상세로
              </Link>
            )}
          </Stack>

          {closed && (
            <Alert severity="info" sx={{ mb: 2 }}>
              종료된 과정입니다
            </Alert>
          )}
          {noticeAlert(notice, () => setNotice(undefined))}
          {courseFields}
          <Stack direction="row" spacing={1} sx={{ mb: 4 }}>
            <Button variant="contained" disabled={locked || !courseValid} onClick={handleSave}>
              저장
            </Button>
            <Button color="error" variant="outlined" disabled={locked} onClick={() => setCloseOpen(true)}>
              과정 종료
            </Button>
          </Stack>

          <Typography variant="h6" component="h2" gutterBottom>
            회차
          </Typography>
          <Paper sx={{ mb: 3 }}>
            <TableContainer>
              <Table aria-label="회차">
                <TableHead>
                  <TableRow>
                    <TableCell>시작일</TableCell>
                    <TableCell>장소</TableCell>
                    <TableCell align="right">남은 자리/정원</TableCell>
                    <TableCell align="center">상태</TableCell>
                    <TableCell align="center">명단</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        회차가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.sessions.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.startDate}</TableCell>
                        <TableCell>{s.place}</TableCell>
                        <TableCell align="right">{`${s.remainingSeats} / ${s.capacity}`}</TableCell>
                        <TableCell align="center">{s.closed ? '마감' : '모집 중'}</TableCell>
                        <TableCell align="center">
                          <Link component={RouterLink} to={`/admin/sessions/${s.id}/roster`} underline="hover">
                            명단
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Typography variant="h6" component="h2" gutterBottom>
            회차 추가
          </Typography>
          {noticeAlert(sessionNotice, () => setSessionNotice(undefined))}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
            <TextField
              label="시작일"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={locked}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="장소"
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              disabled={locked}
              error={place.length > MAX_PLACE}
              helperText={place.length > MAX_PLACE ? `${MAX_PLACE}자 이하로 입력해 주세요` : undefined}
            />
            <TextField
              label="정원"
              type="number"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              disabled={locked}
              slotProps={{ htmlInput: { min: 1 } }}
              error={capacity !== '' && !(capacityNumber >= 1)}
              helperText={capacity !== '' && !(capacityNumber >= 1) ? '1 이상의 정수를 입력해 주세요' : undefined}
            />
            <Button variant="contained" disabled={locked || !sessionValid} onClick={handleAddSession} sx={{ height: 56 }}>
              회차 추가
            </Button>
          </Stack>

          <Dialog open={closeOpen} onClose={() => !pending && setCloseOpen(false)}>
            <DialogTitle>과정을 종료할까요?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                {data.title} — 종료하면 신청과 변경을 할 수 없습니다.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button disabled={pending} onClick={() => setCloseOpen(false)}>
                닫기
              </Button>
              <Button color="error" disabled={pending} onClick={handleClose}>
                종료 확정
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
}
