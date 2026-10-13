## Ticket

[ABC-1234](https://example.atlassian.net/browse/ABC-1234)

## What and why

## How to verify

## Checklist

- [ ] Branch is named `feature/ABC-1234-slug` or `hotfix/ABC-1234-slug` and targets the right base branch
- [ ] PR title is `type(ABC-1234): summary`, because it becomes the changelog entry
- [ ] `npm run verify` passes locally (lint, type-check, tests)
- [ ] Tests added or updated for the behaviour change
- [ ] Breaking change? Title has `!` (`feat(ABC-1234)!: ...`) and the description has a `BREAKING CHANGE:` footer
- [ ] Hotfix only: reproduced on the release branch, and the fix is the smallest change that works
- [ ] Ticket updated: status, and acceptance criteria met
