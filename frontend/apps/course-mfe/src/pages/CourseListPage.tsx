import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
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
import { type FormEvent, useState } from 'react';
import { useCategories } from '../hooks/useCategories';
import { useCourses } from '../hooks/useCourses';

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50];

/** 과정 목록 (FR-01). 서버 데이터는 훅으로만 가져온다 */
export default function CourseListPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  const courses = useCourses({ keyword, category, page, size });
  const categories = useCategories();

  // 검색어나 분류가 바뀌면 첫 페이지부터 다시 본다
  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(0);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(0);
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
                      <TableCell>{course.title}</TableCell>
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
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setSize(Number(event.target.value));
              setPage(0);
            }}
            labelRowsPerPage="페이지당 행 수"
          />
        </Paper>
      )}
    </Container>
  );
}
