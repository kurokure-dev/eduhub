import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Link,
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
import { Link as RouterLink, useParams } from 'react-router-dom';
import { UserResponseRoleEnum } from '@eduhub/api-client';
import { useAuth } from '../auth/AuthContext';
import EnrollButton from '../enrollment/EnrollButton';
import { useCourseDetail } from '../hooks/useCourseDetail';

/** 과정 상세와 회차, 신청 (FR-02, FR-06). 서버 데이터는 훅으로만 가져온다 */
export default function CourseDetailPage() {
  const { courseId } = useParams();
  const { user, initializing } = useAuth();
  // D-54: 관리자는 종료된 과정·회차도 보는 관리자 API를 쓴다
  const admin = user?.role === UserResponseRoleEnum.Admin;
  const { data, loading, notFound, error, refresh } = useCourseDetail(courseId, { admin, enabled: !initializing });
  const columns = admin ? 5 : 4;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* 목록의 검색 상태는 브라우저 기록에 남아 있으므로(D-25) 뒤로 가기로 돌아가면 그대로 보인다 */}
      <Link component={RouterLink} to="/courses" underline="hover" sx={{ display: 'inline-block', mb: 2 }}>
        ← 과정 목록
      </Link>

      {loading || initializing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : notFound ? (
        <Alert severity="info">과정을 찾을 수 없습니다. 없거나 종료된 과정입니다.</Alert>
      ) : error || !data ? (
        <Alert severity="error">과정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="h5" component="h1">
              {data.title}
            </Typography>
            {admin && data.closed && <Chip label="종료" size="small" />}
            {admin && (
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to={`/admin/courses/${data.id}/edit`}
                sx={{ ml: 'auto' }}
              >
                과정 수정
              </Button>
            )}
          </Stack>
          {data.category && <Chip label={data.category} size="small" sx={{ mb: 2 }} />}
          {data.description && (
            <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
              {data.description}
            </Typography>
          )}

          <Typography variant="h6" component="h2" gutterBottom>
            {admin ? '회차' : '모집 중인 회차'}
          </Typography>
          <Paper>
            <TableContainer>
              <Table aria-label={admin ? '회차' : '모집 중인 회차'}>
                <TableHead>
                  <TableRow>
                    <TableCell>시작일</TableCell>
                    <TableCell>장소</TableCell>
                    <TableCell align="right">남은 자리/정원</TableCell>
                    <TableCell align="center">신청</TableCell>
                    {admin && <TableCell align="center">명단</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns} align="center">
                        모집 중인 회차가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    // 회차는 서버가 일정순으로 준다(D-21)
                    data.sessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.startDate}</TableCell>
                        <TableCell>{session.place}</TableCell>
                        <TableCell align="right">{`${session.remainingSeats} / ${session.capacity}`}</TableCell>
                        <TableCell align="center">
                          {data.closed || session.closed ? (
                            // 마감된 회차는 신청할 수 없다 (D-11). 관리자에게만 마감 표시를 보여 준다
                            admin && session.closed ? <Chip label="마감" size="small" /> : null
                          ) : (
                            <EnrollButton
                              // 사용자가 바뀌면 이전 사용자의 결과 안내가 남지 않게 다시 만든다
                              key={`${session.id}-${user?.employeeNo ?? ''}`}
                              sessionId={session.id}
                              onEnrolled={refresh}
                            />
                          )}
                        </TableCell>
                        {admin && (
                          <TableCell align="center">
                            <Link component={RouterLink} to={`/admin/sessions/${session.id}/roster`} underline="hover">
                              명단
                            </Link>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Container>
  );
}
