import { KnightlyJob } from '../types'
import { run } from './run'

export async function build(dir: string, packageJSON: any, { task: { buildScript } }: KnightlyJob) {
  if (buildScript) {
    await run(buildScript, dir, {}, 'inherit')
    return
  }
  // explicitly ignore the script
  if (buildScript === null || buildScript === '')
    return

  if (packageJSON.scripts?.knightly)
    await run('npm run knightly', dir, {}, 'inherit')
  else if (packageJSON.scripts?.build)
    await run('npm run build', dir, {}, 'inherit')
  else
    throw new Error('Can\'t find build script')
}
