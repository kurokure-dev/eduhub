import { Container, Typography } from '@mui/material';

/** 아직 만들지 않은 화면의 자리 표시용 (Step 15·16에서 실제 화면으로 바꾼다) */
export default function PreparingPage({ title }: { title: string }) {
  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h5" component="h1" gutterBottom>
        {title}
      </Typography>
      <Typography>준비 중인 화면입니다.</Typography>
    </Container>
  );
}
