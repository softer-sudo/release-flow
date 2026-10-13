import { createReleaseConfig, currentBranch } from './tools/release-config.ts'

export default createReleaseConfig(currentBranch())
