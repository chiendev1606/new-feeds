/** Store của lesson 03 + reaction có rollback – dùng cho lesson 05, 07, 08. */
import type { ReactNode } from 'react';
import { FeedStoreProvider } from '../03-normalized-store/feed-store-context';
import { feedWithReactionsReducer, INITIAL_REACTION_FEED_STATE } from './reaction-reducer-with-rollback';

export function ReactionFeedStoreProvider({ children }: { children: ReactNode }) {
  return (
    <FeedStoreProvider reducer={feedWithReactionsReducer} initialState={INITIAL_REACTION_FEED_STATE}>
      {children}
    </FeedStoreProvider>
  );
}
