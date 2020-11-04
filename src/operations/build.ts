import { CloneResult, KnightlyJob } from '../types'
import { run } from './run'

export async function build({ root, packageJSON }: CloneResult, { task: { buildScript } }: KnightlyJob) {
  if (buildScript)
    run(buildScript, root, {}, 'inherit')
  else if (packageJSON.scripts?.knightly)
    run('npm run knightly', root, {}, 'inherit')
  else if (packageJSON.scripts?.prepare)
    run('npm run prepare', root, {}, 'inherit')
  else if (packageJSON.scripts?.build)
    run('npm run build', root, {}, 'inherit')

  else
    throw new Error('Can\'t find build script')
}
