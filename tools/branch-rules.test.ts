import { describe, expect, it } from 'vitest'
import { checkPullRequest, verifyReleaseBranch } from './branch-rules.ts'

describe('checkPullRequest', () => {
  it.each([
    ['feature/ABC-1234-add-greeting', 'develop', 'feature'],
    ['hotfix/ABC-1240-fix-crash', 'release/1.3.0', 'hotfix'],
    ['release/1.3.0', 'main', 'release'],
    ['main', 'develop', 'sync'],
  ])('accepts %s -> %s as a %s PR', (head, base, kind) => {
    expect(checkPullRequest(head, base)).toEqual({ ok: true, kind })
  })

  it.each([
    ['feature/add-greeting', 'develop', 'ticket key'],
    ['feature/abc-1234-add-greeting', 'develop', 'ticket key'],
    ['feature/ABC-1234', 'develop', 'ticket key'],
    ['feature/ABC-1234-Add_Greeting', 'develop', 'ticket key'],
    ['fix/ABC-1234-add-greeting', 'develop', 'branch name'],
    ['release/1.3', 'main', 'branch name'],
    ['develop', 'main', 'branch name'],
  ])('rejects the branch name %s', (head, base, hint) => {
    const result = checkPullRequest(head, base)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(hint)
  })

  it.each([
    ['feature/ABC-1234-add-greeting', 'main'],
    ['feature/ABC-1234-add-greeting', 'release/1.3.0'],
    ['hotfix/ABC-1240-fix-crash', 'develop'],
    ['hotfix/ABC-1240-fix-crash', 'main'],
    ['release/1.3.0', 'develop'],
    ['main', 'release/1.3.0'],
  ])('rejects %s -> %s as the wrong target', (head, base) => {
    const result = checkPullRequest(head, base)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('must target')
  })
})

describe('verifyReleaseBranch', () => {
  it('accepts any version on main', () => {
    expect(verifyReleaseBranch('main', '2.0.0')).toEqual({ ok: true })
  })

  it('accepts a release candidate whose base version matches the branch', () => {
    expect(verifyReleaseBranch('release/1.3.0', '1.3.0-rc.2')).toEqual({ ok: true })
  })

  it('rejects a version that differs from the branch name', () => {
    const result = verifyReleaseBranch('release/1.3.0', '1.2.1-rc.1')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('1.2.1')
  })

  it('rejects a surprise major bump', () => {
    expect(verifyReleaseBranch('release/1.3.0', '2.0.0-rc.1').ok).toBe(false)
  })

  it('rejects a release branch that is not named release/x.y.z', () => {
    expect(verifyReleaseBranch('release/next', '1.3.0-rc.1').ok).toBe(false)
  })
})
