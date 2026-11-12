import type { SearchAdminCoursesStatusEnum } from '@eduhub/api-client';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { type FormEvent, useState } from 'react';
import CourseFormDialog from '../components/CourseFormDialog';
import StatusChip from '../components/StatusChip';
import { useAdminCourseActions } from '../hooks/useAdminCourseActions';
import { useAdminCourses } from '../hooks/useAdminCourses';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

interface AdminCourseListPageProps {
  /** 과정 행을 누르면 상세로 간다 */
  onSelect: (courseId: number) => void;
}

/** 관리자 과정 목록 (FR-03, D-34). 종료된 과정도 보이고 상태로 거를 수 있다 */
export default function AdminCourseListPage({ onSelect }: AdminCourseListPageProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<SearchAdminCoursesStatusEnum | ''>('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [creating, setCreating] = useState(false);

  const courses = useAdminCourses({ status, keyword, page, size });
  const actions = useAdminCourseActions();

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const rows = courses.data?.content ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" component="h1">
          과정 관리
        </Typography>
        <Button variant="contained" onClick={() => setCreating(true)}>
          과정 등록
        </Button>
      </Stack>

      <Stack component="form" direction="row" spacing={2} sx={{ mb: 2 }} onSubmit={handleSearch}>
        <TextField
          label="검색어"
          size="small"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          sx={{ flex: 1 }}
        />
        <TextField
          select
          label="상태"
          size="small"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as SearchAdminCoursesStatusEnum | '');
            setPage(0);
          }}
          sx={{ minWidth: 140 }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="OPEN">운영 중</MenuItem>
          <MenuItem value="CLOSED">종료</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined">
          검색
        </Button>
      </Stack>

      {courses.error ? (
        <Alert severity="error">과정 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>
      ) : courses.loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>제목</TableCell>
                  <TableCell>분류</TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      조회된 과정이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((course) => (
                    <TableRow
                      key={course.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => onSelect(course.id!)}
                    >
                      <TableCell>{course.title}</TableCell>
                      <TableCell>{course.category}</TableCell>
                      <TableCell>
                        <StatusChip kind="course" status={course.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={courses.data?.totalElements ?? 0}
            page={page}
            rowsPerPage={size}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setSize(Number(event.target.value));
              setPage(0);
            }}
            labelRowsPerPage="페이지당 행 수"
          />
        </Paper>
      )}

      <CourseFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={async (request) => {
          const created = await actions.createCourse(request);
          // 등록한 과정의 상세로 가서 바로 회차를 추가할 수 있게 한다
          onSelect(created.id!);
        }}
      />
    </Container>
  );
}
