import path from 'path'
import fs from 'fs-extra'
import { NPM_TOKEN } from '../config'
import { KnightlyJob, PackageInfo } from '../types'
import { run } from '.'

function timeout(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function publish({ dir, packageJSON }: PackageInfo, { publishTag, task: { defaultBranch = 'master', publishDir } }: KnightlyJob, dryRun = false) {
  dir = publishDir || dir
  // remove all scripts
  await fs.writeJSON(path.join(dir, 'package.json'), { ...packageJSON, scripts: {} }, { spaces: 2 })

  // publish
  await run(`npm publish --access public --tag ${publishTag} ${dryRun ? '--dry-run' : ''}`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
  if (publishTag === defaultBranch && !dryRun) {
    const version = `${packageJSON.name}@${packageJSON.version}`
    try {
      await timeout(2000)
      await run(`npm dist-tag add ${version} latest`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
    }
    catch (e) {
      console.warn(`failed to tag version ${version} as latest`)
    }
  }
}
