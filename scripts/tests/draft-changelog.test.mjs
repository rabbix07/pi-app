import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { groupCommits, insertSection, renderSection } from '../draft-changelog.mjs'

describe('draft-changelog', () => {
  it('groups commits by type in release order', () => {
    const grouped = groupCommits([
      { subject: 'fix(editor): scroll the tab strip', body: '' },
      { subject: 'feat(status-bar): show today cost', body: '' },
      { subject: 'perf(timeline): trim re-renders', body: '' },
      { subject: 'docs: explain releases', body: '' },
      { subject: 'wip something', body: '' },
    ])

    assert.deepEqual(
      grouped.sections.map(([title]) => title),
      ['新增功能', '修复', '优化', '文档', '其他变更'],
    )
    assert.deepEqual(grouped.sections[0][1], ['- **status-bar**：show today cost'])
    assert.deepEqual(grouped.sections[4][1], ['- wip something'])
  })

  it('lifts breaking changes into their own leading section', () => {
    const grouped = groupCommits([
      { subject: 'feat(api)!: drop the old feed', body: '' },
      { subject: 'fix(store): keep rows', body: 'BREAKING CHANGE: rows are keyed by path' },
      { subject: 'feat(ui): add a badge', body: '' },
    ])

    assert.deepEqual(grouped.breaking, [
      '- **api**：drop the old feed',
      '- **store**：keep rows',
    ])
    assert.deepEqual(
      grouped.sections.map(([title]) => title),
      ['新增功能'],
    )

    const text = renderSection('0.9.0', grouped, '2026-10-28')
    assert.match(text, /^## \[0\.9\.0\] — 2026-10-28/)
    assert.ok(
      text.indexOf('### 破坏性变更') < text.indexOf('### 新增功能'),
      'breaking changes come first',
    )
  })

  it('drops release housekeeping so it never appears in its own notes', () => {
    const grouped = groupCommits([
      { subject: 'chore(release): v0.8.1', body: '' },
      { subject: 'release: v0.8.0', body: '' },
      { subject: 'feat(ui): real change', body: '' },
    ])

    const lines = grouped.sections.flatMap(([, items]) => items)
    assert.deepEqual(lines, ['- **ui**：real change'])
  })

  it('inserts the section under the Unreleased heading', () => {
    const changelog = '# Changelog\n\n## [Unreleased]\n\n## [0.8.0] — 2026-10-28\n\n- old\n'
    const updated = insertSection(changelog, '## [0.8.1] — 2026-10-29\n\n### 修复\n\n- fixed\n')

    assert.match(
      updated,
      /## \[Unreleased\]\n\n## \[0\.8\.1\] — 2026-10-29\n\n### 修复\n\n- fixed\n\n## \[0\.8\.0\]/,
    )
  })

  it('refuses to insert into a changelog without the anchor', () => {
    assert.throws(() => insertSection('# Changelog\n', '## [0.8.1]\n'), /Unreleased/)
  })
})
