import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Link,
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
import { type FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminCourses } from '../hooks/useAdminCourses';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];
const DEFAULT_SIZE = 10;
const STATUSES = ['OPEN', 'CLOSED'] as const;
type StatusFilter = (typeof STATUSES)[number] | '';

interface ListQuery {
  keyword: string;
  status: StatusFilter;
  page: number;
  size: number;
}

/** URL 쿼리에서 목록 상태를 읽는다. 잘못된 값은 기본값으로 본다 (D-25) */
function readQuery(params: URLSearchParams): ListQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  const status = params.get('status');
  return {
    keyword: params.get('keyword') ?? '',
    status: STATUSES.find((s) => s === status) ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: ROWS_PER_PAGE_OPTIONS.includes(size) ? size : DEFAULT_SIZE,
  };
}

/** 목록 상태를 URL 쿼리로 바꾼다. 기본값은 쿼리에서 뺀다 (D-25) */
function toParams({ keyword, status, page, size }: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  if (status) params.set('status', status);
  if (page > 0) params.set('page', String(page));
  if (size !== DEFAULT_SIZE) params.set('size', String(size));
  return params;
}

/** 관리자 과정 목록 (FR-03, D-34, D-56). 종료된 과정도 보이고, 목록 상태는 URL 쿼리에 둔다 (D-25) */
export default function AdminCourseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = readQuery(searchParams);
  const { keyword, status, page, size } = query;
  const [keywordInput, setKeywordInput] = useState(keyword);

  // 뒤로 가기 등으로 URL의 검색어가 바뀌면 입력란도 맞춘다
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

  const courses = useAdminCourses({ status, keyword, page, size });

  const updateQuery = (changes: Partial<ListQuery>) => {
    setSearchParams(toParams({ ...query, ...changes }));
  };

  // 검색어나 상태가 바뀌면 첫 페이지부터 다시 본다
  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({ keyword: keywordInput.trim(), page: 0 });
  };

  const rows = courses.data?.content ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" component="h1">
          과정 관리
        </Typography>
        <Button variant="contained" component={RouterLink} to="/admin/courses/new">
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
          // id가 있어야 MUI가 라벨을 선택 상자에 연결해 접근성 이름("상태")이 생긴다
          id="admin-course-status"
          select
          label="상태"
          size="small"
          value={status}
          // 상태를 바꿀 때 입력란의 검색어도 함께 반영한다
          onChange={(event) =>
            updateQuery({ status: event.target.value as StatusFilter, keyword: keywordInput.trim(), page: 0 })
          }
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
        <Alert
          severity="error"
          action={
            courses.error.kind === 'forbidden' ? undefined : (
              <Button color="inherit" size="small" onClick={courses.reload}>
                다시 시도
              </Button>
            )
          }
        >
          {courses.error.kind === 'forbidden'
            ? '관리자만 볼 수 있습니다.'
            : '과정 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}
        </Alert>
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
                    // D-51: 행 전체를 눌러 수정 화면으로 간다
                    <TableRow
                      key={course.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={(event) => {
                        // 새 탭 열기 같은 보조 클릭이나 텍스트 선택 중에는 이동하지 않는다 (D-51)
                        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
                        if (window.getSelection()?.toString()) return;
                        navigate(`/admin/courses/${course.id}/edit`);
                      }}
                    >
                      <TableCell>
                        {/* 제목 링크는 유지하되 행 클릭과 겹쳐 이동하지 않게 전파를 막는다 (D-51) */}
                        <Link
                          component={RouterLink}
                          to={`/admin/courses/${course.id}/edit`}
                          underline="hover"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {course.title}
                        </Link>
                      </TableCell>
                      <TableCell>{course.category}</TableCell>
                      <TableCell>
                        {course.status === 'CLOSED' ? (
                          <Chip size="small" label="종료" />
                        ) : (
                          <Chip size="small" color="success" label="운영 중" />
                        )}
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
            onPageChange={(_, nextPage) => updateQuery({ page: nextPage })}
            onRowsPerPageChange={(event) => updateQuery({ size: Number(event.target.value), page: 0 })}
            labelRowsPerPage="페이지당 행 수"
          />
        </Paper>
      )}
    </Container>
  );
}
