/**
 * Render markdown bài học thành React:
 *   - khối ```learn path#id``` → LearnCodeBlock (code thật từ source)
 *   - khối ```mermaid```       → MermaidDiagram
 *   - phần còn lại             → HTML do `marked` sinh, với HTML thô trong markdown bị escape,
 *                                 link ngoài mở tab mới (noopener), heading có id để làm mục lục.
 * `marked` được import động (chỉ tải khi mở tab Bài học).
 */
import { useEffect, useState } from 'react';
import type { Token, Tokens, TokensList } from 'marked';
import { escapeHtml } from './highlight-code';
import { LearnCodeBlock } from './learn-code-block';
import { MermaidDiagram } from './mermaid-diagram';
import { parseLearnDirectives } from './source-region-extractor';

export type MarkdownSegment = { kind: 'html'; html: string } | { kind: 'learn'; refs: Array<{ path: string; id: string }> } | { kind: 'mermaid'; code: string };

export interface TocEntry {
  id: string;
  text: string;
}

/** "3. Vì sao cursor?" → "3-vi-sao-cursor" (bỏ dấu tiếng Việt). */
export function slugifyHeading(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function toSegments(markdown: string): Promise<{ segments: MarkdownSegment[]; toc: TocEntry[] }> {
  const { Marked } = await import('marked');
  const marked = new Marked({
    gfm: true,
    renderer: {
      // HTML thô trong markdown → hiện như chữ, không thực thi.
      html: (token) => escapeHtml(token.text),
      heading(token) {
        const text = this.parser.parseInline(token.tokens);
        const id = slugifyHeading(token.text);
        return `<h${token.depth} id="${id}">${text}</h${token.depth}>`;
      },
      link(token) {
        const text = this.parser.parseInline(token.tokens);
        const external = /^https?:\/\//.test(token.href);
        const safeHref = /^(https?:|mailto:|#|\.{0,2}\/)/.test(token.href) ? token.href : '#';
        return `<a href="${escapeHtml(safeHref)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
      },
    },
  });
  const tokens = marked.lexer(markdown);
  const segments: MarkdownSegment[] = [];
  const toc: TocEntry[] = [];
  let pending: Token[] = [];

  const flush = () => {
    if (pending.length === 0) return;
    const list = Object.assign([...pending], { links: tokens.links }) as TokensList;
    segments.push({ kind: 'html', html: marked.parser(list) });
    pending = [];
  };

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 2) {
      toc.push({ id: slugifyHeading((token as Tokens.Heading).text), text: (token as Tokens.Heading).text });
    }
    if (token.type === 'code' && (token as Tokens.Code).lang === 'learn') {
      flush();
      segments.push({ kind: 'learn', refs: parseLearnDirectives(`\`\`\`learn\n${(token as Tokens.Code).text}\n\`\`\``) });
    } else if (token.type === 'code' && (token as Tokens.Code).lang === 'mermaid') {
      flush();
      segments.push({ kind: 'mermaid', code: (token as Tokens.Code).text });
    } else {
      pending.push(token);
    }
  }
  flush();
  return { segments, toc };
}

export function LessonMarkdownView({ markdown, onToc }: { markdown: string; onToc?: (toc: TocEntry[]) => void }) {
  const [segments, setSegments] = useState<MarkdownSegment[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void toSegments(markdown).then((result) => {
      if (cancelled) return;
      setSegments(result.segments);
      onToc?.(result.toc);
    });
    return () => {
      cancelled = true;
    };
  }, [markdown, onToc]);

  if (!segments) return <p className="muted">Đang dựng bài học…</p>;
  return (
    <div className="learn-markdown">
      {segments.map((segment, index) => {
        if (segment.kind === 'learn') return segment.refs.map((ref) => <LearnCodeBlock key={`${index}-${ref.path}#${ref.id}`} path={ref.path} id={ref.id} />);
        if (segment.kind === 'mermaid') return <MermaidDiagram key={index} code={segment.code} />;
        // Nội dung là bài học trong repo, HTML thô đã bị escape ở renderer.
        return <div key={index} dangerouslySetInnerHTML={{ __html: segment.html }} />;
      })}
    </div>
  );
}
