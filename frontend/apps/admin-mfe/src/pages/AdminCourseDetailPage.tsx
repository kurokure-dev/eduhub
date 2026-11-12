import type { AdminSessionResponse } from '@eduhub/api-client';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import CourseFormDialog from '../components/CourseFormDialog';
import FormDialog from '../components/FormDialog';
import SessionFormDialog from '../components/SessionFormDialog';
import StatusChip from '../components/StatusChip';
import { useAdminCourse } from '../hooks/useAdminCourse';
import { useAdminCourseActions } from '../hooks/useAdminCourseActions';

interface AdminCourseDetailPageProps {
  courseId: number;
  onBack: () => void;
}

/** 열려 있는 대화상자 하나 */
type DialogState =
  | { type: 'editCourse' }
  | { type: 'closeCourse' }
  | { type: 'createSession' }
  | { type: 'editSession'; session: AdminSessionResponse }
  | { type: 'closeSession'; session: AdminSessionResponse };

/**
 * 관리자 과정 상세 (FR-03, D-34). 과정 수정·종료와 회차 등록·수정·마감을 한다.
 * 종료된 과정과 마감된 회차는 바꿀 수 없으므로 버튼을 감춘다 (D-32)
 */
export default function AdminCourseDetailPage({ courseId, onBack }: AdminCourseDetailPageProps) {
  const course = useAdminCourse(courseId);
  const actions = useAdminCourseActions();
  const [dialog, setDialog] = useState<DialogState>();

  const closeDialog = () => setDialog(undefined);
  // 성공하면 상세를 다시 불러온다
  const run = (action: () => Promise<unknown>) => async () => {
    await action();
    course.reload();
  };

  if (course.error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button onClick={onBack}>← 목록</Button>
        <Alert severity="error">과정을 불러오지 못했습니다.</Alert>
      </Container>
    );
  }
  if (!course.data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const data = course.data;
  const courseOpen = data.status === 'OPEN';
  const sessions = data.sessions ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button onClick={onBack} sx={{ mb: 1 }}>
        ← 목록
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="h5" component="h1">
            {data.title}
          </Typography>
          <StatusChip kind="course" status={data.status} />
        </Stack>
        <Typography color="text.secondary" gutterBottom>
          {data.category}
        </Typography>
        {data.description && (
          <Typography sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{data.description}</Typography>
        )}
        {courseOpen ? (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => setDialog({ type: 'editCourse' })}>
              과정 수정
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setDialog({ type: 'closeCourse' })}
            >
              과정 종료
            </Button>
          </Stack>
        ) : (
          <Alert severity="info">종료된 과정은 수정하거나 회차를 추가할 수 없습니다.</Alert>
        )}
      </Paper>

      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h2">
          회차
        </Typography>
        {courseOpen && (
          <Button variant="contained" onClick={() => setDialog({ type: 'createSession' })}>
            회차 등록
          </Button>
        )}
      </Stack>
      <Paper>
        <TableContainer>
          <Table aria-label="회차">
            <TableHead>
              <TableRow>
                <TableCell>일정</TableCell>
                <TableCell>장소</TableCell>
                <TableCell align="right">정원</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">관리</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    등록된 회차가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.startDate}</TableCell>
                    <TableCell>{session.place}</TableCell>
                    <TableCell align="right">{session.capacity}</TableCell>
                    <TableCell>
                      <StatusChip kind="session" status={session.status} />
                    </TableCell>
                    <TableCell align="right">
                      {session.status === 'OPEN' && (
                        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            onClick={() => setDialog({ type: 'editSession', session })}
                          >
                            수정
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => setDialog({ type: 'closeSession', session })}
                          >
                            마감
                          </Button>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <CourseFormDialog
        open={dialog?.type === 'editCourse'}
        initial={{
          title: data.title ?? '',
          category: data.category ?? '',
          description: data.description ?? '',
        }}
        onClose={closeDialog}
        onSubmit={(request) => run(() => actions.updateCourse(courseId, request))()}
      />
      <FormDialog
        open={dialog?.type === 'closeCourse'}
        title="과정 종료"
        submitLabel="종료"
        submitColor="error"
        onClose={closeDialog}
        onSubmit={run(() => actions.closeCourse(courseId))}
      >
        <Typography>
          과정을 종료하면 모집 중인 회차도 모두 마감되고, 임직원 과정 목록에서 빠집니다. 종료한 과정은
          다시 열 수 없습니다.
        </Typography>
      </FormDialog>
      <SessionFormDialog
        open={dialog?.type === 'createSession'}
        onClose={closeDialog}
        onSubmit={(request) => run(() => actions.createSession(courseId, request))()}
      />
      <SessionFormDialog
        open={dialog?.type === 'editSession'}
        initial={
          dialog?.type === 'editSession'
            ? {
                startDate: dialog.session.startDate ?? '',
                place: dialog.session.place ?? '',
                capacity: dialog.session.capacity ?? 1,
              }
            : undefined
        }
        onClose={closeDialog}
        onSubmit={(request) =>
          dialog?.type === 'editSession'
            ? run(() => actions.updateSession(courseId, dialog.session.id!, request))()
            : Promise.resolve()
        }
      />
      <FormDialog
        open={dialog?.type === 'closeSession'}
        title="회차 마감"
        submitLabel="마감"
        submitColor="error"
        onClose={closeDialog}
        onSubmit={() =>
          dialog?.type === 'closeSession'
            ? run(() => actions.closeSession(courseId, dialog.session.id!))()
            : Promise.resolve()
        }
      >
        <Typography>
          {dialog?.type === 'closeSession' && `${dialog.session.startDate} ${dialog.session.place} `}
          회차의 모집을 마감합니다. 마감한 회차에는 신청할 수 없고, 정원을 바꾸거나 다시 열 수 없습니다.
        </Typography>
      </FormDialog>
    </Container>
  );
}
