# release-flow

A deliberately trivial TypeScript app wrapped in the process a real team uses to ship it: every change traces back to a ticket, every PR passes the same gates, and a merge produces a version, a changelog, a tag and a GitHub Release without anyone typing a version number.

The app is a one-function `greet()`. The interesting parts are the branching model, the ticket convention, the CI gates and the release automation, and the replayable test that proves they work together.

- [The model in one picture](#the-model-in-one-picture)
- [Conventions](#conventions)
- [Walkthrough: ticket → release → hotfix](#walkthrough-ticket--release--hotfix)
- [What each gate protects against](#what-each-gate-protects-against)
- [How the automation works](#how-the-automation-works)
- [Setting up a repository](#setting-up-a-repository)
- [Replaying the flow without GitHub](#replaying-the-flow-without-github)
- [Gotchas](#gotchas)

## The model in one picture

```
feature/ABC-1234-slug ──squash PR──▶ develop
                                       │  cut when scope is frozen
                                       ▼
                       release/1.3.0 ────────────────▶ v1.3.0-rc.1, rc.2 …   (GitHub pre-releases)
                        ▲     │
 hotfix/ABC-1240-slug ──┘     │  merge-commit PR
 (cut from the release        ▼
  branch, squash PR back)    main ─────────────────▶ v1.3.0   CHANGELOG + version commit + tag + GitHub Release
                               │
                               └─ automated sync PR (merge commit) ──▶ develop
```

| Branch | Purpose | Receives | Releases |
| --- | --- | --- | --- |
| `main` | What is in production | `release/x.y.z` PRs (merge commit) | Final `vX.Y.Z`: writes `CHANGELOG.md` + version, tags, GitHub Release |
| `develop` | Integration of finished tickets | `feature/*` PRs (squash), the sync PR (merge commit) | Nothing |
| `release/x.y.z` | Stabilisation of one release; only fixes land here | `hotfix/*` PRs (squash) | Release candidates `vX.Y.Z-rc.N`: tag + GitHub pre-release, **no commits** |
| `feature/ABC-1234-slug` | One ticket | – | Nothing |
| `hotfix/ABC-1240-slug` | One urgent fix, cut from the release branch it will land on | – | Nothing |

Version bumps come from the commit types (see [How the automation works](#how-the-automation-works)); nobody edits `package.json` by hand.

## Conventions

One ticket key (`ABC-1234`) ties everything together. It is defined in exactly one place, [`tools/ticket.ts`](tools/ticket.ts), together with the tracker URL.

| Where | Format | Example |
| --- | --- | --- |
| Branch | `feature/<KEY>-<slug>` or `hotfix/<KEY>-<slug>` (slug: lowercase kebab) | `feature/ABC-1234-greet-by-name` |
| Release branch | `release/<major>.<minor>.<patch>` | `release/1.3.0` |
| Commit | Conventional Commit with the ticket key as the scope | `feat(ABC-1234): greet by name` |
| PR title | Same as a commit; it becomes the squash commit | `feat(ABC-1234): greet by name` |
| Breaking change | `!` after the scope, plus a footer | `feat(ABC-1234)!: rename greet to hello` |
| Changelog | Generated; each ticket links to the tracker | see below |

Commit types: `feat` → minor, `fix` / `perf` → patch, a `!` or a `BREAKING CHANGE:` footer → major. `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `style` are valid but do not trigger a release.

What the generated changelog looks like (shortened; the format is what the test suite asserts on):

```md
## 1.3.0 (2026-10-13)

### Features

* **ABC-1234:** greet by name ([8f31ec8](…/commit/8f31ec8…)), closes [ABC-1234](https://example.atlassian.net/browse/ABC-1234)

### Bug Fixes

* **ABC-1240:** do not crash on empty input ([a1831e6](…/commit/a1831e6…)), closes [ABC-1240](https://example.atlassian.net/browse/ABC-1240)
```

The PR template ([`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)) carries the checklist.

## Walkthrough: ticket → release → hotfix

### 1. Ticket

Product creates **ABC-1234 "Greet users by name"** in the tracker. The key is now the thread through everything below.

### 2. Branch

```bash
git switch develop && git pull
git switch -c feature/ABC-1234-greet-by-name
```

The branch name is checked in CI, so a typo (`feature/abc-1234-…`, `fix/…`) is caught on the PR, not in a retrospective.

### 3. Commit

```bash
git commit -m "feat(ABC-1234): greet by name"
```

A local `commit-msg` hook (husky + commitlint, installed by `npm ci`) rejects a message without a ticket key before it enters history:

```
✖ scope must be a ticket key, e.g. feat(ABC-1234): add greeting
```

Hooks can be skipped with `--no-verify`, which is why CI repeats the check.

### 4. Pull request

```bash
npm run verify                      # lint + type-check + tests, same as CI
git push -u origin HEAD
gh pr create --base develop --title "feat(ABC-1234): greet by name"
```

Fill in the template's checklist. Four checks run: `lint`, `typecheck`, `test`, `pr-policy`. All four are required.

### 5. Review

At least one approval is required; new pushes dismiss earlier approvals, and open review threads block the merge. The branch must also be up to date with `develop`, so the checks ran against what will actually be merged.

### 6. Merge to `develop`

**Squash and merge.** The PR title becomes the commit, giving `develop` one Conventional Commit per ticket. Nothing is released yet: `develop` never releases.

### 7. Cut a release

When the scope for the next version is frozen, a release manager cuts the branch from `develop`:

```bash
git switch -c release/1.3.0 origin/develop
git push -u origin release/1.3.0
```

The release workflow computes the version from the commits since the last release, checks it matches the branch name (see the [version guard](#what-each-gate-protects-against)), then tags **`v1.3.0-rc.1`** and publishes a GitHub pre-release with notes. Deploy that candidate to staging. No files are committed, so the branch stays identical to what was tested.

The first release of a fresh repository is always `1.0.0`; start with `release/1.0.0`.

### 8. Promote to `main`

Open a PR `release/1.3.0` → `main` and **merge with a merge commit**. The release workflow on `main` then:

1. writes `CHANGELOG.md` and bumps `package.json` / `package-lock.json`,
2. commits them as `chore(release): 1.3.0 [skip ci]`,
3. tags `v1.3.0` and publishes the GitHub Release with the same notes.

### 9. Sync back

The workflow opens a PR `main` → `develop` (title `chore(release): sync main into develop`). Merge it with a merge commit. This carries the release commit and tags into `develop`, which the next release branch needs to compute its version.

### 10. Hotfix while a release is stabilising

A bug is found in `v1.3.0-rc.1` on staging. Branch from the **release branch**, not from `develop`:

```bash
git switch -c hotfix/ABC-1240-fix-empty-input origin/release/1.3.0
git commit -m "fix(ABC-1240): do not crash on empty input"
gh pr create --base release/1.3.0 --title "fix(ABC-1240): do not crash on empty input"
```

Same gates, squash merge. The release workflow tags **`v1.3.0-rc.2`**. When it is verified, promote exactly as in step 8. The fix reaches `develop` through the sync PR.

### 11. Hotfix in production

A bug is found after `v1.3.0` shipped. The fix is a patch, so it gets its own patch release branch, cut from `main` (not from `develop`, which may hold unreleased work):

```bash
git switch -c release/1.3.1 origin/main && git push -u origin release/1.3.1
git switch -c hotfix/ABC-1301-fix-crash release/1.3.1
git commit -m "fix(ABC-1301): fix crash"
gh pr create --base release/1.3.1 --title "fix(ABC-1301): fix crash"
```

Merging tags `v1.3.1-rc.1`; promote `release/1.3.1` → `main` for `v1.3.1`, then merge the sync PR. It is not done on `release/1.3.0` because the commits there would compute `1.3.1`, which the version guard rightly refuses to ship under a `1.3.0` branch.

## What each gate protects against

| Gate | Where it runs | What it protects against |
| --- | --- | --- |
| `commit-msg` hook | Locally (husky + commitlint) | Ticket-less or non-conventional commits entering history; fastest feedback. Bypassable, so never the only line of defence |
| `lint` (ESLint) | PR, release job | Bug-prone patterns and style drift reaching `develop` |
| `typecheck` (`tsc --noEmit`) | PR, release job | Type regressions that tests do not exercise |
| `test` (Vitest) | PR, release job | Behaviour regressions, **and** regressions in the process itself (the release flow is replayed here) |
| `pr-policy`: branch name and target | PR | Untraceable work (no ticket), and shortcuts like a feature PR straight into `main` or a hotfix into `develop` |
| `pr-policy`: PR title and commits | PR (feature/hotfix) | A squash commit that triggers the wrong version bump or leaves a hole in the changelog; PR titles are what the release tool reads |
| Required review, stale approvals dismissed | Ruleset | Unreviewed code, and a change slipped in after approval |
| Branch up to date with base | Ruleset | A green PR that breaks once combined with what merged meanwhile |
| Merge method per branch | Ruleset | Squash on `release/*` and `develop` keeps one commit per ticket; merge-commit on `main` keeps those commits (the release notes are built from them) and keeps tags reachable. A mistaken squash of a promotion PR is blocked outright |
| No deletes, no force-push | Ruleset | Rewriting history under the tags that releases point to |
| `npm run verify` in the release job | Release | Code that reached a long-lived branch without a PR (an admin push, for instance) being released unchecked |
| Version / branch guard | Release (every run) | `release/1.3.0` silently shipping `1.2.1` or `2.0.0` because of the commit types inside it. It also catches a missing sync PR: without the tags, the version computes as `1.0.0-rc.1` and the guard stops the release |
| Concurrency lock per branch | Release | Two release runs racing to tag the same version |
| Sync PR `main` → `develop` | Release (after `main`) | `develop` losing the release tags, which breaks version computation for the next release branch |

## How the automation works

- **Release tool: [semantic-release](https://semantic-release.gitbook.io).** It reads Conventional Commits, so the commit convention above is the release process. Config: [`release.config.js`](release.config.js) → [`tools/release-config.ts`](tools/release-config.ts).
- **One branch per run.** Each workflow run is for exactly one branch. `main` gets the plugins that write files back (changelog, version, git commit); a `release/*` branch gets `-rc` pre-release mode and no file-writing plugins, so promoting never conflicts on `CHANGELOG.md`.
- **Ticket links.** The `conventionalcommits` preset is configured with the ticket prefix and tracker URL from [`tools/ticket.ts`](tools/ticket.ts), so every key found in a commit becomes a link in the notes and in `CHANGELOG.md`.
- **Workflows.** [`ci.yml`](.github/workflows/ci.yml) runs the four PR checks. [`release.yml`](.github/workflows/release.yml) runs on pushes to `main` and `release/**`: verify, release, then (on `main`) open the sync PR.
- **Tools run as TypeScript directly.** Node 24 strips types natively, so `tools/*.ts` need no build step. `.nvmrc` pins Node 24.

## Setting up a repository

```bash
# 1. Create the repo and push the two long-lived branches
gh repo create release-flow --private --source . --remote origin --push
git switch -c develop && git push -u origin develop
gh repo edit --default-branch develop        # PRs target the integration branch by default

# 2. Mandatory checks, review rules and merge methods (needs repo admin and jq)
scripts/apply-rulesets.sh                    # add --print to inspect the JSON first
```

Then, in the repository settings:

- **Pull requests:** allow merge commits and squash merging, disallow rebase merging. Set the squash commit message to **"Default to pull request title"**, so the validated title becomes the commit. Enable "Automatically delete head branches".
- **Secret `RELEASE_TOKEN`:** a token of a repo admin (fine-grained PAT with *Contents* and *Pull requests* write, or a GitHub App added as a ruleset bypass actor). Two reasons it is needed on a protected repo:
  1. the release commit is pushed directly to `main`, which the ruleset blocks for everyone else;
  2. a PR opened with the built-in `GITHUB_TOKEN` does not trigger workflows, so the sync PR would never get its required checks and could not merge.

  Without the secret, the workflows fall back to `GITHUB_TOKEN`. That is enough to try the flow on an unprotected repo (also enable *Settings → Actions → Allow GitHub Actions to create and approve pull requests*).
- **Tracker:** edit `TICKET_PREFIX` and `TRACKER_URL` in [`tools/ticket.ts`](tools/ticket.ts), and the link in the PR template.

Local development:

```bash
nvm use && npm ci          # also installs the commit-msg hook
npm run verify             # lint + type-check + tests
npm start -- Ada           # Hello, Ada!
npm run release:dry        # what would be released from the current branch (needs a GitHub token)
```

## Replaying the flow without GitHub

[`tools/e2e/release-flow.test.ts`](tools/e2e/release-flow.test.ts) builds a throwaway repo with a local bare `origin` and replays the whole model with the real semantic-release and this repo's real config (only the GitHub API call is stubbed): two release candidates, a hotfix, the promotion with its `CHANGELOG`, the sync PR, a production hotfix via a patch branch, and both ways the version guard fires. It runs with `npm test`, so a dependency bump that breaks releases fails a PR instead of a Friday deploy.

## Gotchas

- **Never squash a promotion or sync PR.** A squash commit is not a descendant of the release commit, so its tags are no longer reachable and the next version is computed wrongly. The `main` ruleset allows only merge commits for this reason.
- **Keep one release branch open at a time.** If a production hotfix ships while `release/1.4.0` is open, getting that fix into the open branch is a manual merge; the automation does not model it.
- **`conventional-changelog-conventionalcommits` is pinned to 9.x.** semantic-release 25 bundles `conventional-changelog-writer@8`, which cannot render the 10.x preset. Do not accept an automatic bump to 10 until semantic-release moves.
- **Release candidates do not touch files.** `package.json` still shows the last final version on a release branch; the candidate version lives in the tag.
- **Rulesets on private repositories** need a GitHub plan that supports them. Public repositories always do.
