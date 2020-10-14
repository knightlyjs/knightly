import { KnightlyTask, KnightlyUserConfig } from './types'

export function resolveUserConfig(config: KnightlyUserConfig[]): KnightlyTask[] {
  return config.map((i) => {
    if (i.repoUrl)
      [i.owner, i.repo] = i.repoUrl.split('/')

    return i as KnightlyTask
  })
}
