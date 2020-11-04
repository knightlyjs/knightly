import path from 'path'
import fs from 'fs-extra'
import { CloneResult } from '../types'
import { run } from './run'

export async function install({ root }: CloneResult) {
  if (fs.existsSync(path.join(root, 'yarn.lock')))
    run('yarn', root, { npm_execpath: 'yarn.js' })
  else if (fs.existsSync(path.join(root, 'pnpm-lock.yaml')))
    run('pnpm install -s', root)

  else
    run('npm install -s', root)
}
