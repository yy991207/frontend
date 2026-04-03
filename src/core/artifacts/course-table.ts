type CourseTableCourse = {
  resource_id: string
  title: string
  duration: number
}

export type CourseTableArtifact = {
  type: 'course_table'
  query: string
  total_duration: number
  courses: CourseTableCourse[]
}

function formatDuration(duration: number): string {
  return `${duration.toFixed(1)} 分钟`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeParsedCourseTable(parsedValue: unknown): CourseTableArtifact | null {
  try {
    if (!isRecord(parsedValue)) {
      return null
    }

    if (parsedValue.type !== 'course_table') {
      return null
    }

    const query = readString(parsedValue.query)
    const totalDuration = readNumber(parsedValue.total_duration)

    if (!query || totalDuration === null || !Array.isArray(parsedValue.courses)) {
      return null
    }

    const courses = parsedValue.courses.flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }

      const resourceId = readString(item.resource_id)
      const title = readString(item.title)
      const duration = readNumber(item.duration)

      if (!resourceId || !title || duration === null) {
        return []
      }

      return [{
        resource_id: resourceId,
        title,
        duration,
      }]
    })

    if (!courses.length) {
      return null
    }

    return {
      type: 'course_table',
      query,
      total_duration: totalDuration,
      courses,
    }
  } catch {
    return null
  }
}

function parseLooseCourseTableArtifact(rawContent: string): CourseTableArtifact | null {
  const typeMatched = /"type"\s*:\s*"course_table"/.test(rawContent)

  if (!typeMatched) {
    return null
  }

  const queryMatch = rawContent.match(/"query"\s*:\s*"([\s\S]*?)"\s*,\s*(?="total_duration")/)
  const totalDurationMatch = rawContent.match(/"total_duration"\s*:\s*([0-9]+(?:\.[0-9]+)?)/)

  if (!queryMatch || !totalDurationMatch) {
    return null
  }

  const courses = Array.from(
    rawContent.matchAll(
      /"resource_id"\s*:\s*"([^"]+)"\s*,\s*"title"\s*:\s*"([\s\S]*?)"\s*,\s*"duration"\s*:\s*([0-9]+(?:\.[0-9]+)?)/g,
    ),
  ).flatMap((match) => {
    const resourceId = readString(match[1])
    const title = readString(match[2])
    const duration = readNumber(Number(match[3]))

    if (!resourceId || !title || duration === null) {
      return []
    }

    return [{
      resource_id: resourceId,
      title,
      duration,
    }]
  })

  if (!courses.length) {
    return null
  }

  return {
    type: 'course_table',
    query: queryMatch[1],
    total_duration: Number(totalDurationMatch[1]),
    courses,
  }
}

export function parseCourseTableArtifact(rawContent: string): CourseTableArtifact | null {
  try {
    return normalizeParsedCourseTable(JSON.parse(rawContent))
  } catch {
    // 后端偶尔会返回“接近 JSON 但字符串里双引号没转义”的文本，这里按课程表固定结构做兜底解析，避免右侧只能显示源码。
    return parseLooseCourseTableArtifact(rawContent)
  }
}

export function buildCourseTablePreviewHtml(courseTable: CourseTableArtifact): string {
  const coursesHtml = courseTable.courses.map((course, index) => `
    <article class="course-card">
      <div class="course-index">${index + 1}</div>
      <div class="course-body">
        <h3>${escapeHtml(course.title)}</h3>
        <div class="course-meta">
          <span>时长：${formatDuration(course.duration)}</span>
          <span>资源 ID：${escapeHtml(course.resource_id)}</span>
        </div>
      </div>
    </article>
  `).join('')

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(courseTable.query)}主题课程安排</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --panel: #ffffff;
      --line: rgba(15, 23, 42, 0.08);
      --text: #0f172a;
      --muted: #64748b;
      --accent: #14b8a6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    .page {
      max-width: 860px;
      margin: 0 auto;
      padding: 28px 20px 56px;
    }
    .hero {
      padding: 20px 22px;
      border-radius: 18px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
    }
    .eyebrow {
      color: #0f766e;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    h1 {
      margin: 8px 0 6px;
      font-size: 24px;
      line-height: 1.35;
    }
    .summary {
      margin: 0;
      color: #475569;
      font-size: 14px;
      line-height: 1.6;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .stat-card {
      padding: 14px 16px;
      border-radius: 16px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
    }
    .stat-card span {
      display: block;
      color: var(--muted);
      font-size: 12px;
    }
    .stat-card strong {
      display: block;
      margin-top: 8px;
      font-size: 18px;
      line-height: 1.2;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
    }
    .course-card {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 16px 18px;
      border-radius: 18px;
      background: var(--panel);
      border: 1px solid var(--line);
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.04);
    }
    .course-index {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #14b8a6;
      color: #fff;
      font-size: 14px;
      font-weight: 700;
    }
    .course-body {
      min-width: 0;
      flex: 1;
    }
    .course-body h3 {
      margin: 0;
      font-size: 15px;
      line-height: 1.55;
    }
    .course-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
    @media (max-width: 768px) {
      .page {
        padding: 18px 14px 36px;
      }
      h1 {
        font-size: 20px;
      }
      .stats {
        grid-template-columns: 1fr;
      }
      .course-card {
        padding: 14px 16px;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="eyebrow">课程表</div>
      <h1>${escapeHtml(courseTable.query)}主题课程安排</h1>
      <p class="summary">共 ${courseTable.courses.length} 门课程，总时长 ${formatDuration(courseTable.total_duration)}</p>
      <div class="stats">
        <div class="stat-card">
          <span>课程数量</span>
          <strong>${courseTable.courses.length}</strong>
        </div>
        <div class="stat-card">
          <span>总时长</span>
          <strong>${formatDuration(courseTable.total_duration)}</strong>
        </div>
      </div>
    </section>
    <section class="list">${coursesHtml}</section>
  </main>
</body>
</html>`
}
