/**
 * Khi autoNewPostsEverySec > 0: cứ N giây chèn 1 bài mới → client thấy banner "Có bài mới".
 * Trả về hàm restart() – gọi lại mỗi khi config mô phỏng thay đổi.
 */
import type { AppContext } from '../app-context.js';

export function createNewPostSimulator(context: AppContext) {
  let timer: ReturnType<typeof setInterval> | null = null;

  return function restart() {
    if (timer) clearInterval(timer);
    timer = null;
    const seconds = context.simulation.autoNewPostsEverySec;
    if (seconds <= 0) return;
    timer = setInterval(() => {
      context.repository
        .insertRandomNewPosts(1)
        .then(({ posts, generation }) => console.log(`🆕 (tự động) bài mới ${posts[0]?.id} – generation=${generation}`))
        .catch((error: unknown) => console.error('Không chèn được bài tự động:', error));
    }, seconds * 1000);
    timer.unref?.();
  };
}
