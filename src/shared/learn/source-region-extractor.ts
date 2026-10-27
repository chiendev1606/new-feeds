/**
 * Cắt "đoạn code được trích vào bài học" ra khỏi file source – hàm thuần, dùng cả trong app lẫn test.
 *
 * Trong code, đánh dấu đoạn cần trích (thay <id> bằng tên kebab-case, vd cursor-older):
 *   // #region learn:<id>
 *   ...code...
 *   // #endregion learn:<id>
 * Trong JSX dùng dạng comment JSX bao quanh cùng cú pháp – vẫn được nhận ra.
 *
 * Bài học (markdown) chỉ ghi `path#id`; nội dung lấy từ source lúc hiển thị → code trong bài học
 * KHÔNG BAO GIỜ lệch khỏi code thật. Test lesson-docs.test.ts kiểm tra mọi tham chiếu đều tồn tại.
 */
const REGION_START = /#region\s+learn:([a-z0-9][a-z0-9-]*)/;
const REGION_END = /#endregion\s+learn:([a-z0-9][a-z0-9-]*)/;

export interface SourceRegion {
  id: string;
  /** Dòng đầu tiên của nội dung (1-based, ngay sau dòng marker mở). */
  startLine: number;
  /** Dòng cuối của nội dung (ngay trước dòng marker đóng). */
  endLine: number;
  /** Nội dung đã bỏ thụt lề chung. */
  code: string;
}

export interface RegionScan {
  regions: SourceRegion[];
  /** Marker mở không có marker đóng, đóng không có mở, hoặc id trùng trong cùng file. */
  problems: string[];
}

/** Bỏ phần thụt lề chung của mọi dòng không rỗng – đoạn code trích ra không bị lệch sang phải. */
export function dedent(lines: readonly string[]): string {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^\s*/)![0].length);
  const common = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(common)).join('\n');
}

export function listRegions(source: string): RegionScan {
  const lines = source.split('\n');
  const open = new Map<string, number>();
  const regions: SourceRegion[] = [];
  const problems: string[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    const start = line.match(REGION_START);
    const end = line.match(REGION_END);
    if (start && !end) {
      const id = start[1]!;
      if (open.has(id) || seen.has(id)) problems.push(`id trùng: ${id} (dòng ${index + 1})`);
      open.set(id, index);
    } else if (end) {
      const id = end[1]!;
      const startIndex = open.get(id);
      if (startIndex === undefined) {
        problems.push(`#endregion không có #region: ${id} (dòng ${index + 1})`);
        return;
      }
      open.delete(id);
      seen.add(id);
      regions.push({ id, startLine: startIndex + 2, endLine: index, code: dedent(lines.slice(startIndex + 1, index)) });
    }
  });
  for (const [id, index] of open) problems.push(`#region thiếu #endregion: ${id} (dòng ${index + 1})`);
  return { regions, problems };
}

export function extractRegion(source: string, id: string): SourceRegion | null {
  return listRegions(source).regions.find((region) => region.id === id) ?? null;
}

/** Bỏ các dòng marker region khỏi đoạn code – region lồng nhau không làm bẩn đoạn trích. */
export function stripRegionMarkers(code: string): string {
  return code
    .split('\n')
    .filter((line) => !REGION_START.test(line) && !REGION_END.test(line))
    .join('\n');
}

export interface LearnDirective {
  path: string;
  id: string;
}

const LEARN_BLOCK = /^```learn[ \t]*\n([\s\S]*?)\n```/gm;

/** Tìm mọi khối code ngôn ngữ `learn` trong markdown; mỗi dòng trong khối là một tham chiếu "<path>#<id>". */
export function parseLearnDirectives(markdown: string): LearnDirective[] {
  const directives: LearnDirective[] = [];
  for (const match of markdown.matchAll(LEARN_BLOCK)) {
    for (const raw of match[1]!.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const hash = line.lastIndexOf('#');
      directives.push({ path: hash > 0 ? line.slice(0, hash) : line, id: hash > 0 ? line.slice(hash + 1) : '' });
    }
  }
  return directives;
}
