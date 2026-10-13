import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const runner = path.join(import.meta.dirname, 'run-release.ts')
const REMOTE_URL = 'https://github.com/acme/release-flow.git'

let sandbox: string
let env: NodeJS.ProcessEnv

class Checkout {
  readonly dir: string

  constructor(dir: string) {
    this.dir = dir
  }

  git(...args: string[]): string {
    return execFileSync('git', args, { cwd: this.dir, env, encoding: 'utf8', stdio: 'pipe' }).trim()
  }

  commit(message: string): void {
    this.git('commit', '--allow-empty', '-m', message)
  }

  cut(branch: string, from: string): void {
    this.git('switch', '-c', branch, from)
    this.git('push', 'origin', branch)
  }

  merge(branch: string, into: string): void {
    this.git('switch', into)
    this.git('merge', '--no-ff', branch, '-m', `Merge pull request from ${branch}`)
    this.git('push', 'origin', into)
  }

  release(): { tag: string | null; output: string; failed: boolean } {
    const run = spawnSync('node', [runner], { cwd: this.dir, env, encoding: 'utf8' })
    const output = `${run.stdout}${run.stderr}`
    const match = /RELEASE_RESULT (.+)/.exec(output)
    return { tag: match ? (JSON.parse(match[1] as string) as { tag: string | null }).tag : null, output, failed: run.status !== 0 }
  }

  tags(): string[] {
    return this.git('tag', '--list').split('\n').filter(Boolean).sort()
  }
}

function checkoutOf(originDir: string, name: string): Checkout {
  const dir = path.join(sandbox, name)
  execFileSync('git', ['clone', '--quiet', originDir, dir], { env, stdio: 'pipe' })
  const checkout = new Checkout(dir)
  checkout.git('remote', 'set-url', 'origin', REMOTE_URL)
  checkout.git('config', `url.${originDir}.insteadOf`, REMOTE_URL)
  symlinkSync(path.join(projectRoot, 'node_modules'), path.join(dir, 'node_modules'))
  return checkout
}

let work: Checkout

beforeAll(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), 'release-flow-e2e-'))
  env = {
    PATH: process.env['PATH'],
    HOME: sandbox,
    GIT_AUTHOR_NAME: 'dev',
    GIT_AUTHOR_EMAIL: 'dev@example.com',
    GIT_COMMITTER_NAME: 'dev',
    GIT_COMMITTER_EMAIL: 'dev@example.com',
  }

  const seed = path.join(sandbox, 'seed')
  execFileSync('git', ['init', '--quiet', '-b', 'main', seed], { env, stdio: 'pipe' })
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    cpSync(path.join(projectRoot, file), path.join(seed, file))
  }
  cpSync(path.join(projectRoot, 'tools'), path.join(seed, 'tools'), {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}e2e`),
  })
  execFileSync('sh', ['-c', 'printf "node_modules\\n" > .gitignore && git add -A && git commit -q -m "chore(ABC-1): bootstrap"'], { cwd: seed, env, stdio: 'pipe' })
  const origin = path.join(sandbox, 'origin.git')
  execFileSync('git', ['clone', '--quiet', '--bare', seed, origin], { env, stdio: 'pipe' })

  work = checkoutOf(origin, 'work')
  work.cut('develop', 'main')
}, 60_000)

afterAll(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
})

describe('release flow, replayed end to end', () => {
  it('cuts a release candidate from release/x.y.z without touching the repo', () => {
    work.commit('feat(ABC-1001): add greeting')
    work.commit('fix(ABC-1002): trim names')
    work.git('push', 'origin', 'develop')
    work.cut('release/1.0.0', 'develop')
    const head = work.git('rev-parse', 'HEAD')

    expect(work.release().tag).toBe('v1.0.0-rc.1')
    expect(work.git('rev-parse', 'HEAD')).toBe(head)
  }, 60_000)

  it('a hotfix on the release branch produces the next candidate', () => {
    work.cut('hotfix/ABC-1003-empty-name', 'release/1.0.0')
    work.commit('fix(ABC-1003): handle empty name')
    work.merge('hotfix/ABC-1003-empty-name', 'release/1.0.0')

    expect(work.release().tag).toBe('v1.0.0-rc.2')
  }, 60_000)

  it('promoting to main cuts the final release with CHANGELOG and ticket links', () => {
    work.merge('release/1.0.0', 'main')

    expect(work.release().tag).toBe('v1.0.0')
    expect(work.git('log', '-1', '--format=%s')).toBe('chore(release): 1.0.0 [skip ci]')
    expect(JSON.parse(readFileSync(path.join(work.dir, 'package.json'), 'utf8')).version).toBe('1.0.0')
    const changelog = readFileSync(path.join(work.dir, 'CHANGELOG.md'), 'utf8')
    for (const ticket of ['ABC-1001', 'ABC-1002', 'ABC-1003']) {
      expect(changelog).toContain(`](https://example.atlassian.net/browse/${ticket})`)
    }
  }, 60_000)

  it('refuses a release branch cut from a develop that never got the sync PR', () => {
    const forkOrigin = path.join(sandbox, 'origin-nosync.git')
    cpSync(path.join(sandbox, 'origin.git'), forkOrigin, { recursive: true })
    const stale = checkoutOf(forkOrigin, 'stale')
    stale.git('switch', 'develop')
    stale.commit('feat(ABC-1004): shout option')
    stale.git('push', 'origin', 'develop')
    stale.cut('release/1.1.0', 'develop')

    const result = stale.release()
    expect(result.failed).toBe(true)
    expect(result.output).toContain('plans 1.1.0')
    expect(result.output).toContain('1.0.0-rc.1')
  }, 60_000)

  it('after the sync PR the next release branch computes the right version', () => {
    work.merge('main', 'develop')
    work.commit('feat(ABC-1004): shout option')
    work.git('push', 'origin', 'develop')
    work.cut('release/1.1.0', 'develop')
    expect(work.release().tag).toBe('v1.1.0-rc.1')

    work.merge('release/1.1.0', 'main')
    expect(work.release().tag).toBe('v1.1.0')
    work.merge('main', 'develop')
  }, 60_000)

  it('a production hotfix goes through a patch release branch cut from main', () => {
    work.cut('release/1.1.1', 'main')
    work.cut('hotfix/ABC-1005-crash-on-empty', 'release/1.1.1')
    work.commit('fix(ABC-1005): do not crash on empty input')
    work.merge('hotfix/ABC-1005-crash-on-empty', 'release/1.1.1')
    expect(work.release().tag).toBe('v1.1.1-rc.1')

    work.merge('release/1.1.1', 'main')
    expect(work.release().tag).toBe('v1.1.1')
    expect(work.tags()).toEqual(['v1.0.0', 'v1.0.0-rc.1', 'v1.0.0-rc.2', 'v1.1.0', 'v1.1.0-rc.1', 'v1.1.1', 'v1.1.1-rc.1'])
  }, 60_000)

  it('blocks a release branch whose commits compute a different version', () => {
    work.merge('main', 'develop')
    work.commit('fix(ABC-1006): tiny fix')
    work.git('push', 'origin', 'develop')
    work.cut('release/1.2.0', 'develop')

    const result = work.release()
    expect(result.failed).toBe(true)
    expect(result.output).toContain('plans 1.2.0')
    expect(result.output).toContain('1.1.2-rc.1')
  }, 60_000)
})
