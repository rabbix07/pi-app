import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const root = process.cwd()
const normalize = (text) => text.replace(/\r\n/g, '\n')
const workflow = normalize(readFileSync(join(root, '.github/workflows/release.yml'), 'utf8'))
const builder = normalize(readFileSync(join(root, 'electron-builder.yml'), 'utf8'))

describe('release workflow contract', () => {
  it('publishes the update feed instead of deleting it', () => {
    // latest.yml / latest-mac.yml are the feed electron-updater reads. Upstream removed them, which
    // silently disabled in-app updates.
    assert.doesNotMatch(workflow, /rm\s+.*latest(-mac)?\.yml/)
    assert.match(workflow, /electron-builder --win --publish always/)
  })

  it('creates one draft release before the platform builds run', () => {
    assert.match(workflow, /^\s{2}create-release:/m)
    assert.match(workflow, /gh release create "\$tag" --draft/)
    assert.match(workflow, /^\s{2}build-win:\n\s+needs: create-release/m)
  })

  it('refuses to make a release public without the installer and the feed', () => {
    const publishJob = workflow.slice(workflow.indexOf('  publish:'))
    assert.match(publishJob, /needs: \[create-release, build-win\]/)
    assert.match(publishJob, /for required in latest\.yml; do/)
    assert.match(publishJob, /has no Windows installer/)
    assert.match(publishJob, /--draft=false/)
  })

  it('aligns the packaged version with the pushed tag', () => {
    assert.match(workflow, /npm version "\$ver" --no-git-tag-version --allow-same-version/)
  })

  it('keeps publishing pointed at this fork', () => {
    assert.match(builder, /publish:\n\s+provider: github\n\s+owner: rabbix07\n\s+repo: pi-app/)
  })

  it('has no macOS job without an Apple certificate to sign it', () => {
    // Unsigned macOS builds cannot self-update, so the job would only produce a manual download.
    assert.doesNotMatch(workflow, /^\s{2}build-mac:/m)
  })
})
