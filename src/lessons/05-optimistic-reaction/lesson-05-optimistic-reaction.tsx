/**
 * LESSON 05 – Optimistic reaction (O – Feed post)
 *
 * Store = reducer lesson 03 + reaction reducer (có rollback). Feed dùng lại infinite scroll của lesson 04.
 */
import { memo, useCallback, useState } from 'react';
import { useFeedLoader } from '../../shared/hooks/use-feed-loader';
import { LessonLayout } from '../../shared/ui/lesson-layout';
import { PostCardBasic } from '../../shared/ui/post-card-basic';
import { PostSkeletonList } from '../../shared/ui/post-skeleton';
import type { ReactionType } from '../../shared/types/feed-entities';
import { ToastStack, useToasts } from '../../shared/ui/toast-stack';
import { FeedErrorAlert } from '../../shared/ui/feed-error-alert';
import { useFeedState, usePostView } from '../03-normalized-store/feed-store-context';
import { ReactionFeedStoreProvider } from './reaction-feed-store-provider';
import { REACTION_META, ReactionPicker } from './reaction-picker';
import type { ReactionAwareFeedState } from './reaction-reducer-with-rollback';
import type { ReactionEvent } from './use-toggle-reaction';
import { useToggleReaction } from './use-toggle-reaction';

function ReactablePostCard({ postId, onReactionEvent }: { postId: string; onReactionEvent: (event: ReactionEvent) => void }) {
  const { post, author, media } = usePostView(postId);
  const isPending = Boolean(useFeedState<ReactionAwareFeedState>().pendingReactions[postId]);
  const toggleReaction = useToggleReaction(onReactionEvent);
  if (!post) return null;
  return (
    <PostCardBasic
      post={post}
      author={author}
      media={media}
      footer={
        <ReactionPicker
          viewerReaction={post.viewerReaction}
          summary={post.engagementSummary}
          isPending={isPending}
          onReact={(reaction) => void toggleReaction(post.id, reaction)}
        />
      }
    />
  );
}

interface LoggedEvent {
  at: string;
  event: ReactionEvent;
}

const describeReaction = (reaction: ReactionType | null) => (reaction ? `${REACTION_META[reaction].emoji} ${reaction}` : 'bỏ reaction');

function describeEvent(event: ReactionEvent) {
  switch (event.kind) {
    case 'optimistic':
      return `#${event.requestSeq} ⚡ optimistic → ${describeReaction(event.reaction)} (UI đổi ngay)`;
    case 'queued':
      return `#${event.requestSeq} ⏳ chờ request trước xong rồi mới gửi (gửi tuần tự theo bài)`;
    case 'confirmed':
      return `#${event.requestSeq} ✅ server xác nhận → ${describeReaction(event.reaction)}, tổng ${event.total}`;
    case 'rolledBack':
      return `#${event.requestSeq} ↩️ rollback (${event.message})`;
  }
}

/** memo: thêm dòng vào event log (state của cha) không kéo theo render lại cả feed. */
const ReactionFeed = memo(function ReactionFeed({ onReactionEvent }: { onReactionEvent: (event: ReactionEvent) => void }) {
  const state = useFeedState<ReactionAwareFeedState>();
  const { status, error, retry, sentinelRef } = useFeedLoader();

  return (
    <>
      <div className="feed">
        {status === 'loading-initial' && <PostSkeletonList count={3} />}
        {state.feed.postIds.map((postId) => (
          <ReactablePostCard key={postId} postId={postId} onReactionEvent={onReactionEvent} />
        ))}
        {status === 'loading-older' && <PostSkeletonList count={1} />}
      </div>
      {status === 'error' && <FeedErrorAlert error={error} onRetry={retry} />}
      <div ref={sentinelRef} className="sentinel" aria-hidden="true" />
    </>
  );
});

function EventLogPanel({ events }: { events: LoggedEvent[] }) {
  const pendingCount = Object.keys(useFeedState<ReactionAwareFeedState>().pendingReactions).length;
  return (
    <div className="panel">
      <h2>Event log</h2>
      <p className="muted">Đang chờ server: {pendingCount} bài</p>
      <ol className="event-log">
        {events.map(({ at, event }, index) => (
          <li key={index} className={`event-log__item event-log__item--${event.kind}`}>
            <span className="muted">{at}</span> <code>{event.postId}</code> {describeEvent(event)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Lesson05Content() {
  const { toasts, showToast } = useToasts();
  const [events, setEvents] = useState<LoggedEvent[]>([]);

  const onReactionEvent = useCallback(
    (event: ReactionEvent) => {
      setEvents((current) => [{ at: new Date().toLocaleTimeString(), event }, ...current].slice(0, 30));
      if (event.kind === 'rolledBack') showToast('Không lưu được cảm xúc. Đã hoàn tác.', 'error');
    },
    [showToast],
  );

  return (
    <LessonLayout
      number={5}
      title="Optimistic reaction"
      radioSections="O – Feed post"
      keyFiles={['src/lessons/05-optimistic-reaction/reaction-reducer-with-rollback.ts', 'src/lessons/05-optimistic-reaction/use-toggle-reaction.ts', 'server/src/routes/reaction-routes.ts']}
      observe={[
        'Đặt độ trễ 2000ms, bấm "Thích": số đếm đổi NGAY, sau 2s log hiện "server xác nhận".',
        'Đặt tỉ lệ lỗi 100%, bấm "Thích": UI đổi ngay → 2s sau tự hoàn tác + toast lỗi (rollback).',
        'Độ trễ 2000ms, lỗi 0%, bấm Thích/bỏ Thích 5 lần thật nhanh: UI đổi ở mọi lần bấm, nhưng chỉ ~2 request được gửi (xem terminal). Tải lại trang → server khớp lần bấm cuối.',
        'Mở menu cảm xúc bằng bàn phím: Tab tới nút ▾, Enter, chọn bằng Tab/Enter, Esc để đóng.',
        'Tải lại trang: reaction vẫn còn → server đã lưu thật (xem log PUT/DELETE ở terminal).',
      ]}
      aside={<EventLogPanel events={events} />}
    >
      <ReactionFeed onReactionEvent={onReactionEvent} />
      <ToastStack toasts={toasts} />
    </LessonLayout>
  );
}

export default function Lesson05OptimisticReaction() {
  return (
    <ReactionFeedStoreProvider>
      <Lesson05Content />
    </ReactionFeedStoreProvider>
  );
}
