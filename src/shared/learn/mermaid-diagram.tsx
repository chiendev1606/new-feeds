/**
 * Sơ đồ Mermaid trong bài học. Thư viện mermaid nặng (~1MB) → import động, chỉ tải khi bài học có sơ đồ.
 * securityLevel 'strict': không cho script/HTML tuỳ ý trong nhãn sơ đồ.
 */
import { useEffect, useId, useState } from 'react';

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: dark ? 'dark' : 'default', fontFamily: 'system-ui, sans-serif' });
    return mermaid;
  });
  return mermaidPromise;
}

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const domId = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
    loadMermaid()
      .then((mermaid) => mermaid.render(domId, code))
      .then((result) => !cancelled && setSvg(result.svg))
      .catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (error) {
    return (
      <figure className="learn-diagram learn-diagram--error" data-testid="learn-diagram">
        <figcaption className="error-text">Không vẽ được sơ đồ: {error}</figcaption>
        <pre>{code}</pre>
      </figure>
    );
  }
  return (
    <figure className="learn-diagram" data-testid="learn-diagram" data-rendered={svg ? 'true' : 'false'}>
      {/* SVG do mermaid sinh ở chế độ strict. */}
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="muted">Đang vẽ sơ đồ…</p>}
    </figure>
  );
}
