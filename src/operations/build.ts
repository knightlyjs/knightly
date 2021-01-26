import { CloneResult, KnightlyJob } from '../types'
import { run } from './run'

export async function build({ root, packageJSON }: CloneResult, { task: { buildScript } }: KnightlyJob) {
  if (buildScript) {
    await run(buildScript, root, {}, 'inherit')
    return
  }

  if (buildScript === null || buildScript === '')
    return

  if (packageJSON.scripts?.knightly)
    await run('npm run knightly', root, {}, 'inherit')
  else if (packageJSON.scripts?.build)
    await run('npm run build', root, {}, 'inherit')

  else
    throw new Error('Can\'t find build script')
}
