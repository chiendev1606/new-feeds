/** Toast tối giản – lỗi "nhẹ" (vd reaction thất bại) không cần chặn cả trang. */
import { useCallback, useState } from 'react';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
}

let toastId = 0;

export function useToasts(durationMs = 4000) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback(
    (message: string, tone: Toast['tone'] = 'info') => {
      toastId += 1;
      const id = toastId;
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), durationMs);
    },
    [durationMs],
  );
  return { toasts, showToast };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={toast.tone === 'error' ? 'toast toast--error' : 'toast'}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
