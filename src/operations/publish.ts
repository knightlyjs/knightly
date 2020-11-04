import path from 'path'
import fs from 'fs-extra'
import { NPM_TOKEN } from '../config'
import { KnightlyJob, PackageInfo } from '../types'
import { run } from '.'

export async function publish({ dir, packageJSON }: PackageInfo, { publishTag, task: { defaultBranch = 'master' } }: KnightlyJob, dryRun = false) {
  // remove all scripts
  await fs.writeJSON(path.join(dir, 'package.json'), { ...packageJSON, scripts: {} }, { spaces: 2 })

  // publish
  run(`npm publish --access public --tag ${publishTag} ${dryRun ? '--dry-run' : ''}`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
  if (publishTag === defaultBranch && !dryRun)
    run(`npm dist-tag add ${packageJSON.name}@${packageJSON.version} latest`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
}
