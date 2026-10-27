import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

// The dependency-audit gate and the SBOM/checksum upload used to live in upstream's release job.
// This fork publishes straight from electron-builder (see scripts/tests/release-workflow.test.mjs),
// so only the build-input contract is still checked here.
describe('Release build inputs', () => {
  it('should_use_tracked_fonts_without_installing_an_unused_next_peer', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
    assert.equal(pkg.devDependencies.geist, undefined)
    assert.equal(lock.packages['node_modules/next'], undefined)
    assert.equal(pkg.scripts.build, 'electron-vite build')
    assert.ok(
      readFileSync(join(root, 'src/renderer/public/fonts/geist-mono/GeistMono-Regular.woff2')).length > 0,
    )
    assert.match(
      readFileSync(join(root, 'src/renderer/public/fonts/geist-mono/OFL.txt'), 'utf8'),
      /SIL OPEN FONT LICENSE/,
    )
  })
})
