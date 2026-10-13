import { checkPullRequest } from './branch-rules.ts'

const [head, base] = process.argv.slice(2)
if (head === undefined || base === undefined) {
  console.error('usage: node tools/check-pr.ts <head-ref> <base-ref>')
  process.exit(2)
}

const verdict = checkPullRequest(head, base)
if (!verdict.ok) {
  console.error(`✖ ${verdict.reason}`)
  process.exit(1)
}
console.log(`✔ ${head} -> ${base} is a valid ${verdict.kind} PR`)
