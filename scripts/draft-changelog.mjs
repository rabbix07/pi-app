#!/usr/bin/env node
/**
 * Draft the CHANGELOG section for a version from the commits since the last tag.
 *
 * Grouping mirrors how released projects write notes: one short line per change, grouped by
 * category, breaking changes first. Commit subjects are used verbatim — the section is meant to be
 * read and edited before it is committed, not published raw.
 *
 * Usage:
 *   node scripts/draft-changelog.mjs [version] [--from <ref>] [--write]
 *
 * Without --write the section is printed. With --write it is inserted into CHANGELOG.md under the
 * "Unreleased" heading and that heading is emptied.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Commit type → section heading, in the order sections appear. */
const SECTIONS = [
  ['feat', '新增功能'],
  ['fix', '修复'],
  ['perf', '优化'],
  ['refactor', '重构'],
  ['docs', '文档'],
  ['build', '构建'],
  ['ci', '构建'],
  ['test', '测试'],
]

const OTHER = '其他变更'
/** Release housekeeping must never show up in its own notes. */
const SKIP = /^(chore\(release\)|release:)/
const RECORD = '\x1e'
const FIELD = '\x1f'

/**
 * @param {{sha: string, subject: string, body: string}[]} commits
 * @returns {{breaking: string[], sections: [string, string[]][]}}
 */
export function groupCommits(commits) {
  const breaking = []
  /** @type {Map<string, string[]>} */
  const sections = new Map([...SECTIONS.map(([, title]) => [title, []]), [OTHER, []]])

  for (const commit of commits) {
    if (SKIP.test(commit.subject)) continue

    const match = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/.exec(commit.subject)
    const isBreaking = Boolean(match?.[3]) || /^BREAKING[ -]CHANGE:/m.test(commit.body)
    const line = match
      ? { scope: match[2], text: match[4] }
      : { scope: undefined, text: commit.subject }

    const rendered = renderLine(line)
    if (isBreaking) {
      breaking.push(rendered)
      continue
    }
    const title = SECTIONS.find(([type]) => type === match?.[1])?.[1] ?? OTHER
    const bucket = sections.get(title) ?? []
    bucket.push(rendered)
    sections.set(title, bucket)
  }

  return {
    breaking,
    sections: [...sections].filter(([, lines]) => lines.length > 0),
  }
}

function renderLine({ scope, text }) {
  return scope ? `- **${scope}**：${text}` : `- ${text}`
}

/**
 * @param {string} version
 * @param {{breaking: string[], sections: [string, string[]][]}} grouped
 * @param {string} [date] ISO date, defaults to today
 */
export function renderSection(version, grouped, date = new Date().toISOString().slice(0, 10)) {
  const parts = [`## [${version}] — ${date}`]
  if (grouped.breaking.length > 0) {
    parts.push('', '### 破坏性变更', '', ...grouped.breaking)
  }
  for (const [title, lines] of grouped.sections) {
    parts.push('', `### ${title}`, '', ...lines)
  }
  return `${parts.join('\n')}\n`
}

/** @param {string} changelog */
export function insertSection(changelog, section) {
  const anchor = '## [Unreleased]'
  if (!changelog.includes(anchor)) {
    throw new Error(`CHANGELOG.md has no "${anchor}" heading`)
  }
  // Swallow the blank line that followed the anchor so the section keeps one gap on each side.
  return changelog.replace(
    new RegExp(`${anchor.replaceAll('[', '\\[').replaceAll(']', '\\]')}\\n*`),
    `${anchor}\n\n${section.trimEnd()}\n\n`,
  )
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function readCommits(from) {
  const range = from ? `${from}..HEAD` : 'HEAD'
  const raw = execFileSync(
    'git',
    ['log', '--no-merges', `--pretty=format:%s${FIELD}%b${RECORD}`, range],
    { cwd: root, encoding: 'utf8' },
  )
  return raw
    .split(RECORD)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ''] = record.split(FIELD)
      return { subject: subject.trim(), body }
    })
}

function lastTag() {
  try {
    return git(['describe', '--tags', '--abbrev=0'])
  } catch {
    return undefined
  }
}

function main() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const fromIndex = argv.indexOf('--from')
  const from = fromIndex >= 0 ? argv[fromIndex + 1] : lastTag()
  const version = argv.find((arg, index) => !arg.startsWith('--') && index !== fromIndex + 1)
  if (!version) {
    throw new Error('usage: node scripts/draft-changelog.mjs <version> [--from <ref>] [--write]')
  }

  const grouped = groupCommits(readCommits(from))
  if (grouped.sections.length === 0 && grouped.breaking.length === 0) {
    throw new Error(`no releasable commits since ${from ?? 'the first commit'}`)
  }

  const section = renderSection(version, grouped)
  if (!write) {
    process.stdout.write(section)
    return
  }

  const path = join(root, 'CHANGELOG.md')
  const updated = insertSection(readFileSync(path, 'utf8'), section)
  writeFileSync(path, updated)
  console.error(`[draft-changelog] inserted ${version} into CHANGELOG.md (from ${from ?? 'first commit'})`)
}

if (process.argv[1] && process.argv[1].endsWith('draft-changelog.mjs')) {
  main()
}
