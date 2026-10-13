import { execFileSync } from 'node:child_process'
import { TICKET_PREFIX, TRACKER_URL } from './ticket.ts'

export function currentBranch(): string {
  return (
    process.env['GITHUB_REF_NAME'] ??
    execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
  )
}

export const presetConfig = {
  issuePrefixes: [`${TICKET_PREFIX}-`],
  issueUrlFormat: `${TRACKER_URL}/{{prefix}}{{id}}`,
  types: [
    { type: 'feat', section: 'Features' },
    { type: 'fix', section: 'Bug Fixes' },
    { type: 'perf', section: 'Performance' },
    { type: 'revert', section: 'Reverts' },
  ],
}

type Plugin = [name: string, options: object]

const analysis: Plugin[] = [
  ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits', presetConfig }],
  ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits', presetConfig }],
]

const guard: Plugin[] = [
  [
    '@semantic-release/exec',
    { verifyReleaseCmd: 'node tools/verify-release-branch.ts "${branch.name}" "${nextRelease.version}"' },
  ],
]

const finalOnly: Plugin[] = [
  ['@semantic-release/changelog', { changelogFile: 'CHANGELOG.md', changelogTitle: '# Changelog' }],
  ['@semantic-release/npm', { npmPublish: false }],
  [
    '@semantic-release/git',
    {
      assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
      message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    },
  ],
]

const github: Plugin[] = [
  ['@semantic-release/github', { successComment: false, failComment: false, releasedLabels: false }],
]

export function createReleaseConfig(branch: string) {
  const isReleaseBranch = branch.startsWith('release/')
  return {
    tagFormat: 'v${version}',
    branches: isReleaseBranch ? ['main', { name: branch, prerelease: 'rc' }] : ['main'],
    plugins: [...analysis, ...guard, ...(isReleaseBranch ? [] : finalOnly), ...github],
  }
}
