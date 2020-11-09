import path from 'path'
import Git from 'simple-git'
import fs from 'fs-extra'
import semver from 'semver'
import dayjs from 'dayjs'
import fg from 'fast-glob'
import { KnightlyJob, PackageInfo } from '../types'

export type CloneResult = ReturnType<typeof clone> extends Promise<infer T> ? T : never

export async function clone({ owner, repo, branch: ref, task, publishTag }: KnightlyJob) {
  const now = dayjs()
  const root = path.join(process.cwd(), 'knightly', task.owner, task.repo)
  await fs.ensureDir(root)
  await fs.emptyDir(root)
  const git = Git(root)

  await git.clone(`https://github.com/${owner}/${repo}`, '.', {
    '--depth': 1,
    '--single-branch': null,
    ...ref ? { '--branch': ref } : {},
  })

  const sha = await git.revparse(['HEAD'])
  const packageJSON = await fs.readJSON(path.join(root, 'package.json'))
  const lastMessage = (await git.log(['-1']))?.latest?.message

  const subversion = `knightly${publishTag ? `-${publishTag}` : ''}`
  const targetVersion = `${semver.valid(semver.coerce(packageJSON.version))}-${subversion}.${now.format('YYYYMMDDHHmm')}`

  const packages: PackageInfo[] = []
  if (task.monorepo) {
    const packageDirs = await fg(task.workspaces!, { onlyDirectories: true, cwd: root })

    for (const dirName of packageDirs) {
      const dir = path.join(root, dirName)
      const filepath = path.join(dir, 'package.json')

      if (!fs.existsSync(filepath))
        continue

      const subPackageJSON = await fs.readJSON(filepath)
      if (task.packagesNameMap![subPackageJSON.name] && subPackageJSON.private !== true) {
        packages.push({
          originalName: subPackageJSON.name,
          targetName: task.packagesNameMap![subPackageJSON.name],
          dir,
          filepath,
          packageJSON: subPackageJSON,
        })
      }
    }
  }
  else {
    packages.push({
      originalName: packageJSON.name,
      targetName: task.publishName,
      dir: root,
      filepath: path.join(root, 'package.json'),
      packageJSON,
    })
  }

  return {
    targetVersion,
    packages,
    sha,
    root,
    git,
    packageJSON,
    lastMessage,
  }
}
