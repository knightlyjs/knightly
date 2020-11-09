import path from 'path'
import fs from 'fs-extra'
import { generateREADME } from './template'
import { PackageInfo, KnightlyJob, CloneResult } from './types'

async function rewriteDeps(
  dep: Record<string, string> | undefined,
  map: Record<string, string> = {},
  version: string,
) {
  if (!dep)
    return

  for (const [from, target] of Object.entries(map)) {
    if (dep[from])
      dep[from] = `npm:${target}@${version}`
  }
}

export async function rewritePackageVersion(
  { filepath, packageJSON }: PackageInfo,
  { targetVersion }: CloneResult,
) {
  packageJSON.stableVersion = packageJSON.version
  packageJSON.version = targetVersion

  await fs.writeJSON(filepath, packageJSON, { spaces: 2 })
}

export async function rewritePackage(
  pkg: PackageInfo,
  clone: CloneResult,
  job: KnightlyJob,
) {
  const { filepath, dir, packageJSON, targetName } = pkg
  const { sha, targetVersion } = clone
  const { task } = job

  const readme = generateREADME(pkg, clone, job)

  packageJSON.version = targetVersion
  packageJSON.name = targetName
  packageJSON.gitHead = sha

  rewriteDeps(packageJSON.dependencies, task.packagesNameMap, targetVersion)
  rewriteDeps(packageJSON.devDependencies, task.packagesNameMap, targetVersion)
  rewriteDeps(packageJSON.peerDependencies, task.packagesNameMap, targetVersion)

  await fs.writeJSON(filepath, packageJSON, { spaces: 2 })
  await fs.writeFile(path.join(dir, 'README.md'), readme)
}
