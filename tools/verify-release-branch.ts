import { verifyReleaseBranch } from './branch-rules.ts'

const [branch, version] = process.argv.slice(2)
if (branch === undefined || version === undefined) {
  console.error('usage: node tools/verify-release-branch.ts <branch> <next-version>')
  process.exit(2)
}

const verdict = verifyReleaseBranch(branch, version)
if (!verdict.ok) {
  console.error(`✖ ${verdict.reason}`)
  process.exit(1)
}
console.log(`✔ ${branch} may release ${version}`)
