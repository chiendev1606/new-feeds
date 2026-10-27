/**
 * Gác cổng học liệu: bài học (docs/lessons/*.md) và code phải luôn khớp nhau.
 *   1. Mọi khối ```learn path#id``` trỏ tới file + region có thật.
 *   2. Mỗi khái niệm "## N. ..." có đủ các mục bắt buộc của khung bài học.
 *   3. Không có region hỏng (#region thiếu #endregion, id trùng) trong code.
 *   4. Không có region mồ côi (có trong code nhưng không bài học nào dùng) – bật nghiêm ngặt khi nội dung đã đủ.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listRegions, parseLearnDirectives } from './source-region-extractor';

const ROOT = join(__dirname, '../../..');
const DOCS_DIR = join(ROOT, 'docs/lessons');
/** Đổi thành true khi mọi lesson đã có bài học (phase 4) → region không ai dùng là lỗi. */
const STRICT_ORPHANS = true;

export const REQUIRED_SECTIONS = ['Trong bài viết', 'Code thật', 'Vì sao làm vậy', 'Lỗi hay gặp', 'Tự thử', 'Câu hỏi phỏng vấn'];

const SOURCE_ROOTS = ['src', 'server/src', 'server/db/migrations', 'shared-contracts', 'public'];
const SOURCE_FILE = /\.(ts|tsx|css|sql|js)$/;

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const lessonDocs = walk(DOCS_DIR).filter((file) => file.endsWith('.md') && !/(README|_template)\.md$/.test(file));
const sourceFiles = SOURCE_ROOTS.flatMap((dir) => walk(join(ROOT, dir))).filter((file) => SOURCE_FILE.test(file) && !/\.test\.tsx?$/.test(file));

/** Tách markdown thành các khái niệm "## N. ..." – bỏ qua nội dung trong code block. */
function splitConcepts(markdown: string) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  return withoutCode
    .split(/^## /m)
    .slice(1)
    .filter((section) => /^\d+\./.test(section))
    .map((section) => ({ title: section.split('\n')[0]!.trim(), body: section }));
}

describe('học liệu: tham chiếu code', () => {
  it('tìm thấy thư mục bài học', () => {
    // Chưa có bài học nào thì các test bên dưới không sinh ra – test này giữ cho suite không rỗng.
    expect(Array.isArray(lessonDocs)).toBe(true);
  });

  it.each(lessonDocs.map((file) => [relative(ROOT, file), file]))('%s – mọi khối learn trỏ tới region có thật', (_name, file) => {
    const directives = parseLearnDirectives(readFileSync(file, 'utf8'));
    for (const { path, id } of directives) {
      let source: string;
      try {
        source = readFileSync(join(ROOT, path), 'utf8');
      } catch {
        throw new Error(`File không tồn tại: ${path}`);
      }
      const ids = listRegions(source).regions.map((region) => region.id);
      expect(ids, `Thiếu "#region learn:${id}" trong ${path}`).toContain(id);
    }
  });

  it.each(lessonDocs.map((file) => [relative(ROOT, file), file]))('%s – khái niệm nào cũng đủ khung bài học', (_name, file) => {
    const concepts = splitConcepts(readFileSync(file, 'utf8'));
    expect(concepts.length, 'Cần ít nhất 1 khái niệm "## 1. ..."').toBeGreaterThan(0);
    for (const concept of concepts) {
      for (const section of REQUIRED_SECTIONS) {
        expect(concept.body, `"${concept.title}" thiếu mục "### ${section}"`).toMatch(new RegExp(`^### ${section}`, 'm'));
      }
    }
  });
});

describe('học liệu: region trong code', () => {
  it('không có region hỏng', () => {
    const problems = sourceFiles.flatMap((file) => listRegions(readFileSync(file, 'utf8')).problems.map((problem) => `${relative(ROOT, file)}: ${problem}`));
    expect(problems).toEqual([]);
  });

  it('region nào cũng được ít nhất một bài học dùng', () => {
    const used = new Set(lessonDocs.flatMap((file) => parseLearnDirectives(readFileSync(file, 'utf8')).map(({ path, id }) => `${path}#${id}`)));
    const orphans = sourceFiles.flatMap((file) =>
      listRegions(readFileSync(file, 'utf8'))
        .regions.map((region) => `${relative(ROOT, file)}#${region.id}`)
        .filter((ref) => !used.has(ref)),
    );
    if (!STRICT_ORPHANS) {
      if (orphans.length) console.warn(`[học liệu] ${orphans.length} region chưa có bài học dùng (sẽ là lỗi khi STRICT_ORPHANS = true)`);
      return;
    }
    expect(orphans).toEqual([]);
  });
});
