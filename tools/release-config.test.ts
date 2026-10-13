import { generateNotes } from '@semantic-release/release-notes-generator'
import { describe, expect, it } from 'vitest'
import { createReleaseConfig, presetConfig } from './release-config.ts'

const pluginNames = (config: ReturnType<typeof createReleaseConfig>) =>
  config.plugins.map(([name]) => name)

describe('createReleaseConfig', () => {
  it('main releases finals and writes the changelog back to the repo', () => {
    const config = createReleaseConfig('main')
    expect(config.branches).toEqual(['main'])
    expect(pluginNames(config)).toEqual(
      expect.arrayContaining([
        '@semantic-release/changelog',
        '@semantic-release/npm',
        '@semantic-release/git',
        '@semantic-release/github',
      ]),
    )
  })

  it('a release branch publishes -rc candidates and commits nothing', () => {
    const config = createReleaseConfig('release/1.3.0')
    expect(config.branches).toEqual(['main', { name: 'release/1.3.0', prerelease: 'rc' }])
    const names = pluginNames(config)
    expect(names).toContain('@semantic-release/github')
    expect(names).not.toContain('@semantic-release/git')
    expect(names).not.toContain('@semantic-release/changelog')
  })

  it('always runs the branch/version guard before anything is published', () => {
    for (const branch of ['main', 'release/1.3.0']) {
      const names = pluginNames(createReleaseConfig(branch))
      expect(names.indexOf('@semantic-release/exec')).toBeGreaterThan(-1)
      expect(names.indexOf('@semantic-release/exec')).toBeLessThan(names.indexOf('@semantic-release/github'))
    }
  })

  it('does not release from other branches', () => {
    expect(createReleaseConfig('develop').branches).toEqual(['main'])
  })
})

describe('release notes', () => {
  it('link each ticket key back to the tracker', async () => {
    const commit = (hash: string, subject: string) => ({
      hash: hash.repeat(40),
      message: subject,
      subject,
      body: '',
      committerDate: '2026-10-13',
    })
    const notes = await generateNotes(
      { preset: 'conventionalcommits', presetConfig },
      {
        commits: [commit('a', 'feat(ABC-1234): add greeting'), commit('b', 'fix(ABC-1240): trim names')],
        lastRelease: { gitTag: 'v1.2.0' },
        nextRelease: { gitTag: 'v1.3.0', version: '1.3.0' },
        options: { repositoryUrl: 'https://github.com/acme/release-flow.git' },
        cwd: process.cwd(),
        env: process.env,
        logger: { log() {}, error() {} },
      },
    )
    expect(notes).toContain('[ABC-1234](https://example.atlassian.net/browse/ABC-1234)')
    expect(notes).toContain('[ABC-1240](https://example.atlassian.net/browse/ABC-1240)')
    expect(notes).toContain('### Features')
    expect(notes).toContain('### Bug Fixes')
  })
})
