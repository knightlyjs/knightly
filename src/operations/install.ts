import path from 'path'
import fs from 'fs-extra'
import { CloneResult } from '../types'
import { run } from './run'

export async function install({ root }: CloneResult) {
  if (fs.existsSync(path.join(root, 'yarn.lock')))
    await run('yarn', root)
  else if (fs.existsSync(path.join(root, 'pnpm-lock.yaml')))
    await run('pnpm install', root)
  else
    await run('npm install', root)
}
