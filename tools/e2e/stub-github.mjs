export async function verifyConditions() {}

export async function publish(_pluginConfig, context) {
  context.logger.log('stub GitHub release: %s', context.nextRelease.gitTag)
  return { name: 'stub GitHub release', url: `stub://${context.nextRelease.gitTag}` }
}

export async function addChannel() {}
