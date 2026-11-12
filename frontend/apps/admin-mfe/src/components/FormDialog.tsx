import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import { type FormEvent, type ReactNode, useState } from 'react';
import { toErrorMessage } from '../api/adminCourseApi';

interface FormDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  /** 제출 버튼을 누를 수 있는지 (클라이언트 검증 결과) */
  canSubmit?: boolean;
  /** 거부되면 대화상자에 오류를 보여 주고, 성공하면 닫는다 */
  onSubmit: () => Promise<unknown>;
  onClose: () => void;
  children?: ReactNode;
  submitColor?: 'primary' | 'error';
}

/** 등록·수정·종료에 함께 쓰는 대화상자. 서버 오류(ProblemDetail의 detail)를 안에 보여 준다 */
export default function FormDialog({
  open,
  title,
  submitLabel,
  canSubmit = true,
  onSubmit,
  onClose,
  children,
  submitColor = 'primary',
}: FormDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await onSubmit();
      onClose();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(undefined);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            취소
          </Button>
          <Button
            type="submit"
            variant="contained"
            color={submitColor}
            disabled={!canSubmit || submitting}
          >
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
