import { TICKET_KEY_SOURCE } from './ticket.ts'

export type PullRequestKind = 'feature' | 'hotfix' | 'release' | 'sync'

export type Verdict<T = object> = ({ ok: true } & T) | { ok: false; reason: string }

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const FEATURE = new RegExp(`^feature/${TICKET_KEY_SOURCE}-${SLUG}$`)
const HOTFIX = new RegExp(`^hotfix/${TICKET_KEY_SOURCE}-${SLUG}$`)
const RELEASE = /^release\/(\d+\.\d+\.\d+)$/

const EXAMPLE = {
  feature: 'feature/ABC-1234-short-slug',
  hotfix: 'hotfix/ABC-1240-short-slug',
}

const TARGETS: Record<PullRequestKind, { label: string; matches: (base: string) => boolean }> = {
  feature: { label: 'develop', matches: (base) => base === 'develop' },
  hotfix: { label: 'the release/x.y.z branch it was cut from', matches: (base) => RELEASE.test(base) },
  release: { label: 'main', matches: (base) => base === 'main' },
  sync: { label: 'develop', matches: (base) => base === 'develop' },
}

function classify(head: string): PullRequestKind | undefined {
  if (FEATURE.test(head)) return 'feature'
  if (HOTFIX.test(head)) return 'hotfix'
  if (RELEASE.test(head)) return 'release'
  if (head === 'main') return 'sync'
  return undefined
}

export function checkPullRequest(head: string, base: string): Verdict<{ kind: PullRequestKind }> {
  const kind = classify(head)
  if (kind === undefined) {
    return { ok: false, reason: unknownBranchReason(head) }
  }
  const target = TARGETS[kind]
  if (!target.matches(base)) {
    return {
      ok: false,
      reason: `A ${kind} PR (${head}) must target ${target.label}, not ${base}.`,
    }
  }
  return { ok: true, kind }
}

function unknownBranchReason(head: string): string {
  if (head.startsWith('feature/') || head.startsWith('hotfix/')) {
    const type = head.startsWith('feature/') ? 'feature' : 'hotfix'
    return `"${head}" is missing a valid ticket key or slug. Expected ${EXAMPLE[type]} (ticket key ${TICKET_KEY_SOURCE.replace('\\d+', '<number>')}, then a lowercase-kebab slug).`
  }
  return `"${head}" is not a valid branch name. Use feature/<ticket>-<slug>, hotfix/<ticket>-<slug>, or release/x.y.z (main is allowed only as the head of the sync PR into develop).`
}

export function verifyReleaseBranch(branch: string, version: string): Verdict {
  if (branch === 'main') return { ok: true }
  const match = RELEASE.exec(branch)
  if (match === null) {
    return { ok: false, reason: `"${branch}" is not a release branch: expected release/x.y.z.` }
  }
  const planned = match[1]
  const computed = version.split('-')[0]
  if (computed !== planned) {
    return {
      ok: false,
      reason: `Branch ${branch} plans ${planned}, but the commits on it compute ${version} (${computed}). Rename the branch or fix the commit types before releasing.`,
    }
  }
  return { ok: true }
}
