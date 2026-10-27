import { describe, expect, it } from 'vitest';
import { extractRegion, listRegions, parseLearnDirectives, stripRegionMarkers } from './source-region-extractor';

const SOURCE = [
  'import x from "y";',
  '',
  'function outer() {',
  '  // #region learn:loop',
  '  for (const item of items) {',
  '    use(item);',
  '  }',
  '  // #endregion learn:loop',
  '}',
  'const view = (',
  '  <div>',
  '    {/* #region learn:jsx-part */}',
  '    <span>hi</span>',
  '    {/* #endregion learn:jsx-part */}',
  '  </div>',
  ');',
].join('\n');

describe('listRegions / extractRegion', () => {
  it('cắt đúng nội dung, số dòng 1-based, bỏ thụt lề chung', () => {
    const region = extractRegion(SOURCE, 'loop');
    expect(region).toEqual({ id: 'loop', startLine: 5, endLine: 7, code: 'for (const item of items) {\n  use(item);\n}' });
  });

  it('nhận marker trong JSX', () => {
    expect(extractRegion(SOURCE, 'jsx-part')?.code).toBe('<span>hi</span>');
  });

  it('id không có → null', () => {
    expect(extractRegion(SOURCE, 'nope')).toBeNull();
  });

  it('phát hiện region hỏng: thiếu đóng, đóng thừa, id trùng', () => {
    const broken = ['// #region learn:a', 'x', '// #endregion learn:b', '// #region learn:c', '// #endregion learn:c', '// #region learn:c', '// #endregion learn:c'].join('\n');
    const { problems } = listRegions(broken);
    expect(problems.some((p) => p.includes('thiếu #endregion: a'))).toBe(true);
    expect(problems.some((p) => p.includes('không có #region: b'))).toBe(true);
    expect(problems.some((p) => p.includes('id trùng: c'))).toBe(true);
  });

  it('region lồng nhau: stripRegionMarkers bỏ marker con khỏi đoạn trích', () => {
    const nested = ['// #region learn:outer', 'a();', '// #region learn:inner', 'b();', '// #endregion learn:inner', '// #endregion learn:outer'].join('\n');
    expect(stripRegionMarkers(extractRegion(nested, 'outer')!.code)).toBe('a();\nb();');
    expect(extractRegion(nested, 'inner')?.code).toBe('b();');
  });
});

describe('parseLearnDirectives', () => {
  it('đọc mọi khối learn, mỗi dòng một tham chiếu', () => {
    const markdown = ['# Tiêu đề', '', '```learn', 'server/src/a.ts#cursor-older', 'src/b.tsx#jsx-part', '```', '', '```ts', 'not#learn', '```'].join('\n');
    expect(parseLearnDirectives(markdown)).toEqual([
      { path: 'server/src/a.ts', id: 'cursor-older' },
      { path: 'src/b.tsx', id: 'jsx-part' },
    ]);
  });
});
