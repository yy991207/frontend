import { marked } from 'marked'

export function renderMarkdownToHtml(markdownContent: string): string {
  return marked.parse(markdownContent, { gfm: true, breaks: true }) as string
}

export function buildMarkdownPreviewHtml(
  title: string,
  htmlContent: string,
  fullWidth: boolean = false,
): string {
  const escapedTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

  const pageStyles = fullWidth
    ? `width: 100%; height: 100%; padding: 20px 24px;`
    : `max-width: 860px; margin: 0 auto; padding: 28px 20px 56px;`

  const contentStyles = fullWidth
    ? `padding: 0; border-radius: 0; background: transparent; border: none; box-shadow: none;`
    : `padding: 24px 28px; border-radius: 18px; background: var(--panel); border: 1px solid var(--line); box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);`

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --panel: #ffffff;
      --line: rgba(15, 23, 42, 0.08);
      --text: #0f172a;
      --muted: #64748b;
      --accent: #14b8a6;
      --code-bg: #f1f5f9;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
    }
    body {
      font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
      color: var(--text);
      background: var(--bg);
      line-height: 1.7;
    }
    .page {
      ${pageStyles}
    }
    .content {
      ${contentStyles}
    }
    .content h1,
    .content h2,
    .content h3,
    .content h4,
    .content h5,
    .content h6 {
      margin: 24px 0 16px;
      line-height: 1.4;
    }
    .content h1:first-child,
    .content h2:first-child,
    .content h3:first-child,
    .content h4:first-child,
    .content h5:first-child,
    .content h6:first-child {
      margin-top: 0;
    }
    .content h1 { font-size: 28px; }
    .content h2 { font-size: 24px; }
    .content h3 { font-size: 20px; }
    .content h4 { font-size: 18px; }
    .content h5 { font-size: 16px; }
    .content h6 { font-size: 14px; }
    .content p {
      margin: 16px 0;
    }
    .content p:first-child {
      margin-top: 0;
    }
    .content p:last-child {
      margin-bottom: 0;
    }
    .content ul,
    .content ol {
      margin: 16px 0;
      padding-left: 28px;
    }
    .content li {
      margin: 8px 0;
    }
    .content a {
      color: var(--accent);
      text-decoration: none;
    }
    .content a:hover {
      text-decoration: underline;
    }
    .content code {
      font-family: "SF Mono", "Monaco", "Consolas", monospace;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 6px;
      background: var(--code-bg);
    }
    .content pre {
      margin: 16px 0;
      padding: 16px 20px;
      border-radius: 12px;
      background: var(--code-bg);
      overflow-x: auto;
    }
    .content pre code {
      padding: 0;
      background: none;
      font-size: 14px;
      line-height: 1.6;
    }
    .content blockquote {
      margin: 16px 0;
      padding: 12px 20px;
      border-left: 4px solid var(--accent);
      border-radius: 0 12px 12px 0;
      background: var(--code-bg);
      color: var(--muted);
    }
    .content blockquote p {
      margin: 0;
    }
    .content table {
      width: 100%;
      margin: 16px 0;
      border-collapse: collapse;
      border-radius: 12px;
      overflow: hidden;
    }
    .content th,
    .content td {
      padding: 12px 16px;
      border: 1px solid var(--line);
      text-align: left;
    }
    .content th {
      background: var(--code-bg);
      font-weight: 600;
    }
    .content img {
      max-width: 100%;
      height: auto;
      border-radius: 12px;
      margin: 16px 0;
    }
    .content hr {
      margin: 24px 0;
      border: none;
      border-top: 1px solid var(--line);
    }
  </style>
</head>
<body>
  <main class="page">
    <article class="content">${htmlContent}</article>
  </main>
</body>
</html>`
}