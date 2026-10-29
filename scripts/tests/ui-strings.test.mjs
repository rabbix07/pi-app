import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { spawnSync } from 'node:child_process'

describe('check-ui-strings', () => {
  it('reports no hardcoded CJK UI text in the renderer', () => {
    const result = spawnSync(process.execPath, ['scripts/check-ui-strings.mjs'], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /check-ui-strings\] ok/)
  })
})
