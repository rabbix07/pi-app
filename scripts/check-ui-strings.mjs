#!/usr/bin/env node
/**
 * Fails when renderer code carries hardcoded CJK text outside the locale files.
 *
 * The English UI once showed Chinese because components held literals instead of
 * calling `t()`. Translation now lives in `src/renderer/src/locales`, so any CJK
 * character in renderer source is either a missed literal or a detection pattern.
 *
 * Exempt: `src/main` (Chinese comments are allowed there), model output, and the
 * files below, which match Chinese source text on purpose.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'src/renderer/src'
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/

/** Files whose CJK is data, not UI copy. */
const ALLOWED = new Set([
  'components/app/panel-resize-edge.tsx',
  'features/settings/appearance-theme-editor.tsx',
  'features/settings/model-provider-presets.ts',
  'features/settings/prompt-catalog-i18n.ts',
  'features/shell/command-palette.tsx',
  'features/timeline/markdown-math-preprocess.ts',
  'locales/en/common.json',
  'locales/en/composer.json',
  'locales/en/context.json',
  'locales/en/extension.json',
  'locales/en/files.json',
  'locales/en/review.json',
  'locales/en/timeline.json',
  'locales/en/update.json',
])

const ALLOWED_PREFIXES = ['locales/zh/']
const SOURCE = /\.(ts|tsx)$/

/** Comment-only lines are Chinese prose; skip them, keep inline code after `//`. */
function isCommentLine(line) {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const offenders = []
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split('\\').join('/')
  if (!SOURCE.test(rel)) continue
  if (rel.includes('.test.') || rel.includes('__tests__')) continue
  if (ALLOWED.has(rel) || ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      if (isCommentLine(line)) return
      if (line.includes('i18n-exempt')) return
      // Drop trailing `// …` notes so Chinese prose after code does not trip the check.
      const code = line.includes('//') ? line.slice(0, line.indexOf('//')) : line
      if (CJK.test(code)) offenders.push({ file: rel, line: index + 1, text: line.trim().slice(0, 120) })
    })
}

if (offenders.length > 0) {
  console.error('[check-ui-strings] hardcoded CJK text in renderer source:')
  for (const hit of offenders) console.error(`  ${ROOT}/${hit.file}:${hit.line}  ${hit.text}`)
  console.error('\nMove the text into src/renderer/src/locales and call t(), or add the file to ALLOWED.')
  process.exit(1)
}

console.log('[check-ui-strings] ok')
