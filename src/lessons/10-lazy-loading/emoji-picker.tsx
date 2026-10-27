/** Bảng chọn emoji – CHUNK tải lười (Tier 3): chỉ cần khi người dùng bấm nút 😊 trong composer. */

export const EMOJI_LIST = ['😀', '😂', '🥹', '😍', '😎', '🤔', '😢', '😡', '👍', '👏', '🙏', '🔥', '🎉', '❤️', '☕', '🚀', '🌸', '🍜', '🇻🇳', '✨'] as const;

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div role="group" aria-label="Chọn emoji" className="emoji-picker" data-testid="emoji-picker">
      {EMOJI_LIST.map((emoji) => (
        <button key={emoji} type="button" className="emoji-picker__item" onClick={() => onPick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
