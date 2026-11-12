import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
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
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';
import { useCourses } from '../hooks/useCourses';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];
const DEFAULT_SIZE = 10;

interface ListQuery {
  keyword: string;
  category: string;
  page: number;
  size: number;
}

/** URL 쿼리에서 목록 상태를 읽는다. 잘못된 값은 기본값으로 본다 (D-25) */
function readQuery(params: URLSearchParams): ListQuery {
  const page = Number(params.get('page'));
  const size = Number(params.get('size'));
  return {
    keyword: params.get('keyword') ?? '',
    category: params.get('category') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
    size: ROWS_PER_PAGE_OPTIONS.includes(size) ? size : DEFAULT_SIZE,
  };
}

/** 목록 상태를 URL 쿼리로 바꾼다. 기본값은 쿼리에서 뺀다 (D-25) */
function toParams({ keyword, category, page, size }: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (keyword) params.set('keyword', keyword);
  if (category) params.set('category', category);
  if (page > 0) params.set('page', String(page));
  if (size !== DEFAULT_SIZE) params.set('size', String(size));
  return params;
}

/** 과정 목록 (FR-01). 서버 데이터는 훅으로만 가져오고, 검색 상태는 URL 쿼리에 둔다 (D-25) */
export default function CourseListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = readQuery(searchParams);
  const { keyword, category, page, size } = query;
  const [keywordInput, setKeywordInput] = useState(keyword);

  // 뒤로 가기 등으로 URL의 검색어가 바뀌면 입력란도 맞춘다
  useEffect(() => {
    setKeywordInput(keyword);
  }, [keyword]);

  const courses = useCourses({ keyword, category, page, size });
  const categories = useCategories();

  const updateQuery = (changes: Partial<ListQuery>) => {
    setSearchParams(toParams({ ...query, ...changes }));
  };

  // 검색어나 분류가 바뀌면 첫 페이지부터 다시 본다
  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    updateQuery({ keyword: keywordInput.trim(), page: 0 });
  };

  const handleCategoryChange = (value: string) => {
    updateQuery({ category: value, page: 0 });
  };

  const rows = courses.data?.content ?? [];

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        교육과정
      </Typography>

      <Stack component="form" direction="row" spacing={2} sx={{ mb: 2 }} onSubmit={handleSearch}>
        <TextField
          label="검색어"
          size="small"
          value={keywordInput}
          onChange={(event) => setKeywordInput(event.target.value)}
          sx={{ flex: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="category-label">분류</InputLabel>
          <Select
            labelId="category-label"
            label="분류"
            value={category}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <MenuItem value="">전체</MenuItem>
            {categories.data.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button type="submit" variant="contained">
          검색
        </Button>
      </Stack>

      {categories.error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          분류 목록을 불러오지 못했습니다.
        </Alert>
      )}

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
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} align="center">
                      조회된 과정이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        {/* 제목을 상세 링크로 둔다 (D-26) */}
                        <Link component={RouterLink} to={`/courses/${course.id}`} underline="hover">
                          {course.title}
                        </Link>
                      </TableCell>
                      <TableCell>{course.category}</TableCell>
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
