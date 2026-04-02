import type { ReactNode } from 'react'

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }

    return part
  })
}

export function renderMessageMarkdown(content: string): ReactNode {
  const lines = content.split('\n')
  const nodes: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }

      nodes.push(
        <pre key={`code-${index}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )

      index += 1
      continue
    }

    if (trimmed.startsWith('### ')) {
      nodes.push(<h4 key={`h4-${index}`}>{trimmed.slice(4)}</h4>)
      index += 1
      continue
    }

    if (trimmed.startsWith('## ')) {
      nodes.push(<h3 key={`h3-${index}`}>{trimmed.slice(3)}</h3>)
      index += 1
      continue
    }

    if (trimmed.startsWith('# ')) {
      nodes.push(<h2 key={`h2-${index}`}>{trimmed.slice(2)}</h2>)
      index += 1
      continue
    }

    if (trimmed.startsWith('- ')) {
      const items: ReactNode[] = []

      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        const itemText = lines[index].trim().slice(2)
        items.push(<li key={`li-${index}`}>{renderInlineMarkdown(itemText)}</li>)
        index += 1
      }

      nodes.push(<ul key={`ul-${index}`}>{items}</ul>)
      continue
    }

    const paragraphLines = [trimmed]
    index += 1

    while (index < lines.length) {
      const nextTrimmed = lines[index].trim()
      if (!nextTrimmed || nextTrimmed.startsWith('#') || nextTrimmed.startsWith('- ') || nextTrimmed.startsWith('```')) {
        break
      }
      paragraphLines.push(nextTrimmed)
      index += 1
    }

    nodes.push(
      <p key={`p-${index}`}>
        {renderInlineMarkdown(paragraphLines.join(' '))}
      </p>,
    )
  }

  return nodes
}
