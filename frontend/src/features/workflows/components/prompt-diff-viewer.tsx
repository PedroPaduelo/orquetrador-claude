interface PromptDiffViewerProps {
  oldContent: string
  newContent: string
}

export function PromptDiffViewer({ oldContent, newContent }: PromptDiffViewerProps) {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const maxLen = Math.max(oldLines.length, newLines.length)

  const diffLines: Array<{
    type: 'unchanged' | 'removed' | 'added'
    content: string
  }> = []

  // Simple line-by-line diff
  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldIdx < oldLines.length ? oldLines[oldIdx] : undefined
    const newLine = newIdx < newLines.length ? newLines[newIdx] : undefined

    if (oldLine === newLine) {
      diffLines.push({ type: 'unchanged', content: oldLine ?? '' })
      oldIdx++
      newIdx++
    } else {
      // Look ahead to find if the old line appears later in new (added lines)
      // or if the new line appears later in old (removed lines)
      const newLineInOld =
        oldLine !== undefined
          ? newLines.indexOf(oldLine, newIdx)
          : -1
      const oldLineInNew =
        newLine !== undefined
          ? oldLines.indexOf(newLine, oldIdx)
          : -1

      if (oldLine !== undefined && (newLineInOld === -1 || (oldLineInNew !== -1 && oldLineInNew <= oldIdx + 2))) {
        diffLines.push({ type: 'removed', content: oldLine })
        oldIdx++
      } else if (newLine !== undefined) {
        diffLines.push({ type: 'added', content: newLine })
        newIdx++
      } else {
        oldIdx++
        newIdx++
      }
    }

    // Safety guard against infinite loops
    if (diffLines.length > maxLen * 3) break
  }

  return (
    <div className="rounded-lg border bg-muted/30 overflow-hidden">
      <div className="overflow-x-auto">
        <pre className="text-xs font-mono p-3 leading-relaxed">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === 'removed'
                  ? 'bg-red-500/15 text-red-400 px-2 -mx-2'
                  : line.type === 'added'
                    ? 'bg-emerald-500/15 text-emerald-400 px-2 -mx-2'
                    : 'text-muted-foreground'
              }
            >
              <span className="select-none inline-block w-5 text-muted-foreground/40 mr-2">
                {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
              </span>
              {line.content}
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
