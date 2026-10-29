import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { OverlayScrollHost2D } from '@renderer/components/ui/overlay-scrollbar'
import { highlightCodeToLines, type CodeLineTokens } from '@renderer/lib/shiki-highlighter'
import { LineGutterAddButton } from '@renderer/components/ui/line-gutter-add'
import { PREVIEW_SHIKI_MAX_CHARS } from './file-preview-limits'

type Props = {
  code: string
  lang?: string
  fill?: boolean
  /** Workspace-relative path for line refs into the composer */
  path?: string
  sourceLocation?: { line: number } | null
}

/**
 * Workspace file code preview: full content (no auto-fold), Shiki colours when possible.
 * Rendered one row per source line so wrapped lines keep their own gutter number and
 * the line-ref button lines up with the text it points at.
 */
export function FileSourcePreview({
  code,
  lang,
  fill,
  path,
  sourceLocation,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null)
  const plainLineRef = useRef<HTMLSpanElement>(null)
  const [tokens, setTokens] = useState<CodeLineTokens[] | null>(null)

  const displayCode = code
  const useShiki = displayCode.length <= PREVIEW_SHIKI_MAX_CHARS
  const hasLocation = !!sourceLocation
  const outlined = useShiki || hasLocation
  const lines = useMemo(() => outlined ? displayCode.split('\n') : [], [displayCode, outlined])
  const targetLine = sourceLocation && sourceLocation.line > 0 && sourceLocation.line <= lines.length ? sourceLocation.line : null

  useEffect(() => {
    setTokens(null)
  }, [code])

  useEffect(() => {
    if (!useShiki) {
      setTokens(null)
      return
    }
    let cancelled = false
    highlightCodeToLines(displayCode, lang).then((highlighted) => {
      if (!cancelled) setTokens(highlighted)
    })
    return () => {
      cancelled = true
    }
  }, [displayCode, lang, useShiki])

  useEffect(() => {
    if (!targetLine) return
    const target = previewRef.current?.querySelector('[data-source-line]') ?? plainLineRef.current
    if (!target) return
    target.classList.add('bg-accent/15')
    target.scrollIntoView({ block: 'center', inline: 'nearest' })
    return () => {
      target.classList.remove('bg-accent/15')
    }
  }, [tokens, displayCode, sourceLocation, targetLine])

  const lineCount = lines.length
  const gutterCh = Math.max(2, String(lineCount).length) + 2
  const gutterStyle = { minWidth: `${gutterCh + 2}ch` }

  return (
    <div
      ref={previewRef}
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--code-bg)]',
        !fill && 'border border-border/50',
      )}
    >
      <OverlayScrollHost2D
        className={cn('files-preview-scroll-host min-h-0 flex-1', fill && 'h-full')}
        scrollClassName="min-h-full"
        showRailOnHostHover
      >
        {useShiki ? (
          <div className="native-code-shiki min-h-full py-2 font-mono text-[11px] leading-[1.5] text-foreground">
            {lines.map((lineText, lineIndex) => {
              const rowTokens = tokens?.[lineIndex]
              const isTarget = targetLine === lineIndex + 1
              return (
                <div
                  key={lineIndex}
                  data-source-line={isTarget ? targetLine : undefined}
                  className={cn('group/line flex items-start pr-4', isTarget && 'bg-accent/15')}
                >
                  <span
                    className="sticky left-0 z-[2] flex shrink-0 select-none items-center justify-end gap-0.5 border-r border-border/50 bg-[var(--bg-2)] py-px pl-1 pr-2 text-right text-foreground-secondary/70"
                    style={gutterStyle}
                    aria-hidden
                  >
                    {path ? (
                      <LineGutterAddButton path={path} line={lineIndex + 1} content={lineText} />
                    ) : (
                      <span className="w-[1.15em]" />
                    )}
                    <span className="w-[2.5ch] text-right tabular-nums">{lineIndex + 1}</span>
                  </span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words pl-3">
                    {rowTokens?.length
                      ? rowTokens.map((token, tokenIndex) => (
                        <span
                          key={tokenIndex}
                          style={{
                            color: token.color,
                            fontStyle: token.italic ? 'italic' : undefined,
                            fontWeight: token.bold ? 600 : undefined,
                          }}
                        >
                          {token.content}
                        </span>
                      ))
                      : lineText}
                    {'\u200b'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <pre className="m-0 whitespace-pre-wrap break-words py-2 pl-5 pr-4 font-mono text-[11px] leading-[1.5] text-foreground">
            {targetLine ? <>
              {targetLine > 1 ? lines.slice(0, targetLine - 1).join('\n') + '\n' : ''}
              <span ref={plainLineRef} data-source-line={targetLine}>{lines[targetLine - 1]}</span>
              {targetLine < lines.length ? '\n' + lines.slice(targetLine).join('\n') : ''}
            </> : displayCode}
          </pre>
        )}
      </OverlayScrollHost2D>
    </div>
  )
}
