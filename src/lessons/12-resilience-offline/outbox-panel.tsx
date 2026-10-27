/** Composer chữ + danh sách outbox (các bài đang chờ mạng). Chỉ lo hiển thị; logic ở use-offline-outbox.ts. */
import { useState } from 'react';
import type { OutboxItem } from '../../shared/offline/post-outbox';

const TOO_LONG_TEXT = 'a'.repeat(5001);

export interface OutboxPanelProps {
  ready: boolean;
  setupError: string | null;
  items: OutboxItem[];
  onSubmit: (text: string) => Promise<boolean>;
  onDiscard: (key: string) => void;
  onFlush: () => void;
}

export function OutboxPanel({ ready, setupError, items, onSubmit, onDiscard, onFlush }: OutboxPanelProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Chỉ xoá composer khi bài đã đăng hoặc đã nằm an toàn trong outbox; thất bại thì giữ nguyên chữ để người dùng sửa.
      if (await onSubmit(text)) setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel" aria-label="Soạn bài và outbox">
      <h2>Đăng bài chữ (outbox)</h2>
      <p className="muted">Chỉ bài chữ: ảnh cần vòng đời upload riêng nên không vào outbox.</p>
      {setupError && <p role="alert" className="error-text">Không khởi tạo được outbox: {setupError}</p>}
      <label htmlFor="l12-composer">Nội dung</label>
      <textarea id="l12-composer" data-testid="offline-composer" className="l12-composer" rows={3} value={text} onChange={(event) => setText(event.target.value)} placeholder="Thử tắt mạng (DevTools → Network → Offline) rồi đăng…" />
      <div className="l12-actions">
        <button type="button" data-testid="offline-submit" disabled={!ready || submitting || !text.trim()} onClick={() => void handleSubmit()}>
          {submitting ? 'Đang gửi…' : 'Đăng'}
        </button>
        <button type="button" onClick={() => setText(TOO_LONG_TEXT)} title="Server giới hạn 5000 ký tự → 400, lỗi không retry được">
          Điền 5001 ký tự (→ 400)
        </button>
        <button type="button" onClick={onFlush} disabled={!ready}>
          Flush outbox ngay
        </button>
      </div>

      <h3>Outbox ({items.length})</h3>
      <ul data-testid="outbox-list" className="l12-outbox">
        {items.length === 0 && <li className="muted">Trống – mọi bài đã lên server.</li>}
        {items.map((item) => (
          <li key={item.idempotencyKey} data-key={item.idempotencyKey} data-state={item.state}>
            <strong>{item.state === 'rejected' ? '⛔ bị từ chối' : '⏳ chờ mạng'}</strong> · lần thử: {item.attempts} · key <code>{item.idempotencyKey.slice(0, 8)}…</code>
            <div className="l12-outbox__text">{item.payload.body.text.slice(0, 80)}{item.payload.body.text.length > 80 ? '…' : ''}</div>
            {item.lastError && <div className="error-text">Lỗi gần nhất: {item.lastError}</div>}
            <button type="button" onClick={() => onDiscard(item.idempotencyKey)}>
              Bỏ mục này
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
