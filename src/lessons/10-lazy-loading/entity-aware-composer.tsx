/**
 * Composer nhận biết entity: gõ "@handle #hashtag https://…" → preview đúng như bài sẽ hiển thị.
 *
 * Model nội bộ vs wire format: người dùng gõ TEXT THUẦN (textarea, không contenteditable); entity được
 * SUY RA từ text bằng parseComposerText (hàm thuần, dễ test) mỗi lần render preview và lúc gửi. Cách này
 * tránh lệch giữa "cái đang hiển thị" và "cái gửi đi" – cùng một parser phục vụ cả hai.
 *
 * Paste: clipboard có thể chứa HTML/ký tự lạ → chặn hành vi mặc định, chỉ lấy text/plain rồi lọc
 * (composer-text-utils.ts). Lưu ý IME: KHÔNG chuẩn hoá NFC lúc đang gõ (sẽ phá việc ghép chữ);
 * chỉ chuẩn hoá khi parse/gửi.
 */
import type { ClipboardEvent } from 'react';
import { Suspense, useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createIdempotencyKey } from '../../shared/api/http-client';
import { ChunkErrorBoundary } from '../../shared/lazy/chunk-error-boundary';
import { lazyWithPreload } from '../../shared/lazy/lazy-with-preload';
import { PostBodyText } from '../../shared/post-rendering/render-post-body-with-entities';
import type { PostBody, User } from '../../shared/types/feed-entities';
import { toErrorMessage } from '../../shared/utils/to-error-message';
import { canSubmitDraft, composerDraftReducer, INITIAL_COMPOSER_STATE } from '../06-composer-upload/composer-draft-reducer';
import { buildUsersByHandle, parseComposerText } from './composer-entity-parser';
import { sanitizePastedText, spliceAtSelection } from './composer-text-utils';
import './lesson-10-lazy-loading.css';

const LazyEmojiPicker = lazyWithPreload(() => import('./emoji-picker'));
export const preloadEmojiPicker = () => LazyEmojiPicker.preload();

const MAX_LENGTH = 5000;
const HANDLE_SUGGESTION_COUNT = 5;

export interface EntityComposerSubmitPayload {
  /** text đã NFC + entities đã parse – đúng wire format của server. */
  body: PostBody;
  idempotencyKey: string;
}

export interface EntityAwareComposerProps {
  usersById: Record<string, User>;
  /** Ném lỗi nếu thất bại → composer giữ draft (và key) để thử lại. */
  onSubmit: (payload: EntityComposerSubmitPayload) => Promise<void>;
  onLog: (line: string) => void;
}

export function EntityAwareComposer({ usersById, onSubmit, onLog }: EntityAwareComposerProps) {
  const [state, dispatch] = useReducer(composerDraftReducer, INITIAL_COMPOSER_STATE);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaId = useId();
  const emojiPanelId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiToggleRef = useRef<HTMLButtonElement>(null);
  /** Vị trí con trỏ cần đặt lại sau khi React cập nhật value (do paste/chèn emoji). */
  const pendingCaretRef = useRef<number | null>(null);
  const isSubmitting = state.submitState === 'submitting';

  const usersByHandle = useMemo(() => buildUsersByHandle(usersById), [usersById]);
  const parsed = useMemo(() => parseComposerText(state.text, usersByHandle), [state.text, usersByHandle]);
  const suggestions = useMemo(() => Object.values(usersById).slice(0, HANDLE_SUGGESTION_COUNT), [usersById]);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !textareaRef.current) return;
    textareaRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [state.text]);

  // Esc đóng bảng emoji và trả focus về nút 😊 (a11y).
  useEffect(() => {
    if (!emojiOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setEmojiOpen(false);
        emojiToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [emojiOpen]);

  const insertText = (insert: string) => {
    const area = textareaRef.current;
    const start = area?.selectionStart ?? state.text.length;
    const end = area?.selectionEnd ?? state.text.length;
    const result = spliceAtSelection(state.text, start, end, insert, MAX_LENGTH);
    pendingCaretRef.current = result.caret;
    dispatch({ type: 'textChanged', text: result.value });
  };

  // 📖 Bài học lesson-10 §5 – chặn paste mặc định, chỉ lấy text/plain (docs/lessons/lesson-10.md)
  // #region learn:composer-paste-handler
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (isSubmitting) return;
    event.preventDefault();
    const plain = event.clipboardData.getData('text/plain');
    const html = event.clipboardData.getData('text/html');
    const clean = sanitizePastedText(plain);
    const removed = plain.length - clean.length;
    const line = `📋 paste: lấy text/plain (${clean.length} ký tự)${html ? `, BỎ text/html (${html.length} ký tự)` : ''}${removed > 0 ? `, loại ${removed} ký tự điều khiển/zero-width` : ''}`;
    console.info('[composer]', line);
    onLog(line);
    insertText(clean);
  };
  // #endregion learn:composer-paste-handler

  const submit = async () => {
    if (!canSubmitDraft(state)) return;
    // Key sinh ở lần gửi đầu, retry dùng lại (reducer giữ); sửa chữ → key bị xoá (xem composer-draft-reducer).
    const key = state.idempotencyKey ?? createIdempotencyKey();
    dispatch({ type: 'submitStarted', newKey: key });
    try {
      await onSubmit({ body: { text: parsed.text, entities: parsed.entities }, idempotencyKey: key });
      dispatch({ type: 'submitSucceeded' });
    } catch (error) {
      dispatch({ type: 'submitFailed', error: toErrorMessage(error) });
    }
  };

  return (
    <form
      className="composer panel"
      data-testid="entity-composer"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={textareaId} className="composer__label">
        Bạn đang nghĩ gì? (thử: "Chào @{suggestions[0]?.handle ?? 'an1'} #frontend https://example.com")
      </label>
      <textarea
        ref={textareaRef}
        id={textareaId}
        data-testid="composer-textarea"
        value={state.text}
        dir="auto"
        rows={3}
        readOnly={isSubmitting}
        maxLength={MAX_LENGTH}
        placeholder="Viết gì đó… (Ctrl/⌘ + Enter để đăng)"
        onChange={(event) => dispatch({ type: 'textChanged', text: event.target.value })}
        onPaste={handlePaste}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit();
        }}
      />

      <div className="composer__suggestions" aria-label="Chèn nhanh @handle">
        <span className="muted">Handle có sẵn:</span>
        {suggestions.map((user) => (
          <button key={user.id} type="button" className="link-button" disabled={isSubmitting} onClick={() => insertText(`@${user.handle} `)}>
            @{user.handle}
          </button>
        ))}
      </div>

      <div className="composer__preview" aria-live="off">
        <span className="muted">Preview (entity suy ra từ text):</span>
        <p className="post-text" data-testid="composer-preview" dir="auto">
          {parsed.text ? <PostBodyText body={parsed} usersById={usersById} /> : <span className="muted">…</span>}
        </p>
        <ul className="composer__entities" data-testid="composer-entities">
          {parsed.entities.map((entity) => (
            <li key={`${entity.type}-${entity.start}`}>
              <code>{entity.type}</code> [{entity.start}, {entity.end}) “{parsed.text.slice(entity.start, entity.end)}”
            </li>
          ))}
        </ul>
      </div>

      <div className="composer__actions">
        <div className="emoji-anchor">
          {/* 📖 Bài học lesson-10 §3 – preload emoji picker khi hover hoặc focus nút (docs/lessons/lesson-10.md) */}
          {/* #region learn:emoji-toggle-preload */}
          <button
            ref={emojiToggleRef}
            type="button"
            data-testid="emoji-toggle"
            aria-label="Chèn emoji"
            aria-expanded={emojiOpen}
            aria-controls={emojiPanelId}
            disabled={isSubmitting}
            onPointerEnter={preloadEmojiPicker}
            onFocus={preloadEmojiPicker}
            onClick={() => setEmojiOpen((value) => !value)}
          >
            😊
          </button>
          {/* #endregion learn:emoji-toggle-preload */}
          {emojiOpen && (
            <div id={emojiPanelId} className="emoji-popover">
              <ChunkErrorBoundary name="emoji-picker">
                <Suspense fallback={<div className="emoji-picker" aria-hidden="true" />}>
                  <LazyEmojiPicker
                    onPick={(emoji) => {
                      insertText(emoji);
                      setEmojiOpen(false);
                      textareaRef.current?.focus();
                    }}
                  />
                </Suspense>
              </ChunkErrorBoundary>
            </div>
          )}
        </div>
        <button type="submit" className="primary" data-testid="composer-submit" disabled={!canSubmitDraft(state)}>
          {isSubmitting ? 'Đang đăng…' : state.submitState === 'error' ? 'Thử lại' : 'Đăng'}
        </button>
      </div>

      <p className="muted" aria-live="polite">
        {state.error && <span className="error-text">Đăng thất bại: {state.error}. Bấm "Thử lại" – dùng LẠI cùng key. </span>}
        {state.idempotencyKey && (
          <>
            Idempotency-Key: <code>{state.idempotencyKey.slice(0, 8)}…</code>
          </>
        )}
      </p>
    </form>
  );
}
