import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useCourseDetail } from '../hooks/useCourseDetail';

const SESSION_COLUMNS = 5;

/** 과정 상세와 모집 중인 회차 (FR-02). 서버 데이터는 훅으로만 가져온다 */
export default function CourseDetailPage() {
  const { id } = useParams();
  const { data, loading, notFound, error } = useCourseDetail(id);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* 목록의 검색 상태는 브라우저 기록에 남아 있으므로(D-25) 뒤로 가기로 돌아가면 그대로 보인다 */}
      <Link component={RouterLink} to="/courses" underline="hover" sx={{ display: 'inline-block', mb: 2 }}>
        ← 과정 목록
      </Link>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : notFound ? (
        <Alert severity="info">과정을 찾을 수 없습니다. 없거나 종료된 과정입니다.</Alert>
      ) : error || !data ? (
        <Alert severity="error">과정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>
      ) : (
        <>
          <Typography variant="h5" component="h1" gutterBottom>
            {data.title}
          </Typography>
          {data.category && <Chip label={data.category} size="small" sx={{ mb: 2 }} />}
          {data.description && (
            <Typography variant="body1" sx={{ mb: 3, whiteSpace: 'pre-line' }}>
              {data.description}
            </Typography>
          )}

          <Typography variant="h6" component="h2" gutterBottom>
            모집 중인 회차
          </Typography>
          <Paper>
            <TableContainer>
              <Table aria-label="모집 중인 회차">
                <TableHead>
                  <TableRow>
                    <TableCell>일정</TableCell>
                    <TableCell>장소</TableCell>
                    <TableCell align="right">정원</TableCell>
                    <TableCell align="right">남은 자리</TableCell>
                    <TableCell align="center">신청</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data.sessions ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={SESSION_COLUMNS} align="center">
                        모집 중인 회차가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    // 회차는 서버가 일정순으로 준다(D-21)
                    data.sessions!.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{session.startDate}</TableCell>
                        <TableCell>{session.place}</TableCell>
                        <TableCell align="right">{session.capacity}</TableCell>
                        <TableCell align="right">{session.remainingSeats}</TableCell>
                        <TableCell align="center">
                          {/* 신청 기능은 FR-04에서 붙인다 (D-27) */}
                          <Button size="small" variant="outlined" disabled>
                            신청
                          </Button>
                        </TableCell>
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
