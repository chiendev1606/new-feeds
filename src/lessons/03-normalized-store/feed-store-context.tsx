/**
 * Đưa normalized store vào React Context + các hook selector.
 *
 * Component chỉ "chọn" phần mình cần: usePost(id), useUser(id)...
 * Production dùng Redux/Zustand/Relay store với selector để tránh re-render thừa;
 * ở đây dùng useReducer + Context cho dễ đọc (mọi consumer re-render khi state đổi –
 * chấp nhận được với quy mô demo, và lesson 08 virtualization giảm số component cần render).
 */
import { createContext, useContext, useReducer, type Dispatch, type ReactNode, type Reducer } from 'react';
import type { FeedStoreAction, FeedState } from './feed-store-reducer';
import { feedStoreReducer, INITIAL_FEED_STATE } from './feed-store-reducer';

interface FeedStoreContextValue {
  state: FeedState;
  dispatch: Dispatch<{ type: string }>;
}

const FeedStoreContext = createContext<FeedStoreContextValue | null>(null);

export interface FeedStoreProviderProps<S extends FeedState, A extends { type: string }> {
  children: ReactNode;
  /**
   * Lesson sau có thể "mở rộng" reducer (vd lesson 05 thêm reaction + rollback)
   * bằng cách truyền reducer khác nhưng vẫn giữ hình dạng FeedState.
   */
  reducer?: Reducer<S, A>;
  initialState?: S;
}

export function FeedStoreProvider<S extends FeedState = FeedState, A extends { type: string } = FeedStoreAction>({
  children,
  reducer,
  initialState,
}: FeedStoreProviderProps<S, A>) {
  const [state, dispatch] = useReducer(
    (reducer ?? feedStoreReducer) as unknown as Reducer<S, A>,
    (initialState ?? INITIAL_FEED_STATE) as S,
  );
  return <FeedStoreContext.Provider value={{ state, dispatch: dispatch as Dispatch<{ type: string }> }}>{children}</FeedStoreContext.Provider>;
}

function useFeedStoreContext() {
  const value = useContext(FeedStoreContext);
  if (!value) throw new Error('Phải dùng bên trong <FeedStoreProvider>');
  return value;
}

/** Đọc toàn bộ state – kiểu S cho lesson có state mở rộng. */
export function useFeedState<S extends FeedState = FeedState>() {
  return useFeedStoreContext().state as S;
}

export function useFeedDispatch<A extends { type: string } = FeedStoreAction>() {
  return useFeedStoreContext().dispatch as Dispatch<A>;
}

export const usePost = (postId: string) => useFeedState().postsById[postId];
export const useUser = (userId: string | undefined) => {
  const users = useFeedState().usersById;
  return userId ? users[userId] : undefined;
};
export const usePostMedia = (mediaIds: readonly string[]) => {
  const mediaById = useFeedState().mediaById;
  return mediaIds.map((id) => mediaById[id]).filter((item) => item !== undefined);
};

/** Bộ ba dữ liệu một card cần: bài viết, tác giả, ảnh – đều đọc từ store theo id. */
export function usePostView(postId: string) {
  const post = usePost(postId);
  const author = useUser(post?.authorId);
  const media = usePostMedia(post?.mediaIds ?? []);
  return { post, author, media };
}
