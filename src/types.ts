import { runPublishJob } from './tasks/runPublishJob'

export type { CloneResult } from './operations/clone'

export type JobResult = ReturnType<typeof runPublishJob> extends Promise<infer T> ? T : never

export interface KnightlyTask {
  publishName: string
  owner: string
  repo: string

  defaultBranch?: string
  branches?: string[]
  pulls?: number[]

  buildScript?: string
  basePath?: string

  monorepo?: boolean
  workspaces?: string | string[]
  packagesNameMap?: Record<string, string>

  noSkip?: boolean
  official?: boolean
  maintainers?: string[]
  enabled?: boolean
}

export interface KnightlyJob {
  pr?: number
  publishTag: string
  owner: string
  repo: string
  branch: string
  task: KnightlyTask
}

export interface PackageInfo {
  originalName: string
  targetName: string
  dir: string
  filepath: string
  packageJSON: any
}
