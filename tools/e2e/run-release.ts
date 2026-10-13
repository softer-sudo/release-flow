import { execFileSync } from 'node:child_process'
import path from 'node:path'
import semanticRelease from 'semantic-release'
import { createReleaseConfig } from '../release-config.ts'

const GITHUB_PLUGIN = '@semantic-release/github'
const stub = path.join(import.meta.dirname, 'stub-github.mjs')

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim()
const config = createReleaseConfig(branch)
const plugins = config.plugins.map((plugin) => (plugin[0] === GITHUB_PLUGIN ? stub : plugin))

try {
  const result = await semanticRelease({ ...config, plugins, ci: false }, { cwd: process.cwd(), env: process.env })
  console.log(`RELEASE_RESULT ${JSON.stringify({ tag: result ? result.nextRelease.gitTag : null })}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
