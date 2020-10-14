import path from 'path'
import { execSync } from 'child_process'
import Git from 'simple-git'
import fs from 'fs-extra'
import semver from 'semver'
import dayjs from 'dayjs'
import pacote from 'pacote'
import chalk from 'chalk'
import { paramCase } from 'param-case'
import fg from 'fast-glob'
import { CI, KNIGHTLY_DEBUG, NPM_TOKEN, octokit } from './config'
import { KnightlyJob, KnightlyTask, PackageInfo } from './types'

export type CloneResult = ReturnType<typeof clone> extends Promise<infer T> ? T : never
export type JobResult = ReturnType<typeof runPublishJob> extends Promise<infer T> ? T : never
export * from './types'
export * from './utils'
export { version } from '../package.json'

async function run(command: string, dir: string, env: Record<string, string> = {}, stdio?: 'inherit') {
  console.log(chalk.blue(`$ ${command}`))
  try {
    execSync(command, {
      cwd: dir,
      stdio: KNIGHTLY_DEBUG ? 'inherit' : stdio,
      env: CI
        ? {
          ...process.env,
          NODE_AUTH_TOKEN: '',
          NPM_TOKEN: '',
          GITHUB_TOKEN: '',
          ...env,
        }
        : {
          ...process.env,
          ...env,
        },
    })
  }
  catch (error) {
    if (error.status !== 0) {
      console.error(error.stderr?.toString() || error)
      throw new Error(`[${error.status}] ${error.message}`)
    }
  }
}

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
      const subPackageJSON = await fs.readJSON(path.join(dir, 'package.json'))
      if (task.packagesNameMap![subPackageJSON.name] && subPackageJSON.private !== true) {
        packages.push({
          originalName: subPackageJSON.name,
          targetName: task.packagesNameMap![subPackageJSON.name],
          dir,
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

export async function install({ root }: CloneResult) {
  if (fs.existsSync(path.join(root, 'yarn.lock')))
    run('yarn', root, { npm_execpath: 'yarn.js' })
  else if (fs.existsSync(path.join(root, 'pnpm-lock.yaml')))
    run('pnpm install -s', root)
  else
    run('npm install -s', root)
}

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

function getTimestampBadge() {
  return `![${new Date().toISOString()}](https://img.shields.io/date/${Math.round(
    +new Date() / 1000,
  )}?color=eee&label=)`
}

async function rewriteDeps(
  dep: Record<string, string> | undefined,
  map: Record<string, string> = {},
  version: string,
) {
  if (!dep)
    return

  for (const [f, t] of Object.entries(map)) {
    if (dep[f]) {
      delete dep[f]
      dep[t] = version
    }
  }
}

export async function rewriteSingle(
  { dir, packageJSON, originalName, targetName }: PackageInfo,
  { sha, lastMessage, targetVersion }: CloneResult,
  { pr, task, publishTag }: KnightlyJob,
) {
  const now = dayjs()

  const headUrl = `https://github.com/${task.owner}/${task.repo}/tree/${sha}`
  const repoLink = `[${task.owner}/${task.repo}@${sha.slice(0, 5)}](${headUrl})`
  const knightlyLink = '[Knightly](https://github.com/knightlyjs/knightly)'
  const npmRange = `npm:${targetName}${publishTag ? `@${publishTag}` : ''}`
  const compareLink = pr
    ? `//github.com/${task.owner}/${task.repo}/pull/${pr}/files`
    : `//github.com/${task.owner}/${task.repo}/compare/v${packageJSON.version}...${sha}`

  const readme = `
# [${originalName}](//github.com/${task.owner}/${task.repo})

[![Knightly Build](https://github.com/knightlyjs/knightly/blob/main/res/badge.svg?raw=true)](https://github.com/knightlyjs/knightly) ${getTimestampBadge()}

${task.official ? '' : '[**Unofficial**] '}Nightly build for ${repoLink}, published automatically by ${knightlyLink}.

| | |
| --- | --- |
| package (\`${originalName}\`) | \`${targetName}\` |
| version (\`${packageJSON.version}*\`) | \`${targetVersion}\` |
| last commit | ${lastMessage} |
| sha (\`${publishTag || 'HEAD'}\`) | \`${sha}\` |
| changes | [compare with last release](${compareLink}) |
| build | ${now.toISOString()} |
${pr ? `| PR | [#${pr}](//github.com/${task.owner}/${task.repo}/pull/${pr}) |\n` : ''}${task.maintainer ? `| builds mantained by | [@${task.maintainer}](//github.com/${task.maintainer}) |\n` : ''}

> [More PRs and branches builds](//www.npmjs.com/package/${targetName}?activeTab=versions)

### Usage

To replace the package with nightly build:

via \`npm\`

\`\`\`bash
npm i ${originalName}@${npmRange}
\`\`\`

or edit your \`package.json\`

\`\`\`json
"dependencies": {
  "${packageJSON.name}": "${npmRange}"
}
\`\`\`
`

  packageJSON.version = targetVersion
  packageJSON.name = targetName
  packageJSON.gitHead = sha

  rewriteDeps(packageJSON.dependencies, task.packagesNameMap, targetVersion)
  rewriteDeps(packageJSON.devDependencies, task.packagesNameMap, targetVersion)
  rewriteDeps(packageJSON.peerDependencies, task.packagesNameMap, targetVersion)

  await fs.writeJSON(path.join(dir, 'package.json'), packageJSON, { spaces: 2 })
  await fs.writeFile(path.join(dir, 'README.md'), readme)
}

export async function resolveTasks(tasks: KnightlyTask | KnightlyTask[]): Promise<KnightlyJob[]> {
  if (!Array.isArray(tasks))
    tasks = [tasks]
  const jobs: KnightlyJob[] = []

  for (const task of tasks) {
    if (task.enabled === false)
      continue

    for (const branch of task.branches || []) {
      jobs.push({
        task,
        branch,
        publishTag: paramCase(branch),
        owner: task.owner,
        repo: task.repo,
      })
    }

    for (const number of task.pulls || []) {
      const { data: pull } = await octokit.pulls.get({
        owner: task.owner,
        repo: task.repo,
        pull_number: number,
      })

      if (pull && pull.state === 'open') {
        jobs.push({
          task,
          pr: pull.number,
          owner: pull.head.repo.owner.login,
          repo: pull.head.repo.name,
          branch: pull.head.ref,
          publishTag: `pr${pull.number}`,
        })
      }
    }
  }

  return jobs
}

export async function runPublishJob(job: KnightlyJob, dryRun = false) {
  console.log(chalk.magenta(`= Preparing ${job.task.publishName} @${job.publishTag || 'latest'}`))

  const errors: Error[] = []
  let remoteSha = ''
  let cloneResult: CloneResult | undefined
  let remoteManifest: pacote.Manifest | undefined

  try {
    remoteManifest = await pacote.manifest(`${job.task.publishName}@${job.publishTag || 'latest'}`, { fullMetadata: true })
    remoteSha = remoteManifest.gitHead as string
  }
  catch {}

  const { data: { commit: { sha: gitSha } } } = await octokit.repos.getBranch({
    owner: job.owner,
    repo: job.repo,
    branch: job.branch,
  })

  if (remoteSha === gitSha && !job.task.noSkip) {
    console.log(chalk.yellow('% Same git sha with remote, build skipped'))
    console.log()
    return {
      remoteManifest,
      cloneResult,
      job,
      errors,
    }
  }

  console.log(`- Cloning ${chalk.green(`${job.owner}/${job.repo} ${job.branch ? `-b ${job.branch}` : ''}`)} ${job.pr ? chalk.magenta(`(#${job.pr})`) : ''}`)

  try {
    cloneResult = await clone(job)

    console.log(`- Building ${job.task.publishName}`)

    for (const pkg of cloneResult.packages)
      await rewriteSingle(pkg, cloneResult, job)

    await install(cloneResult)
    await build(cloneResult, job)

    for (const pkg of cloneResult.packages) {
      try {
        await publishSingle(pkg, job, dryRun)
        console.log(chalk.green(`- Published ${pkg.targetName} @${cloneResult.targetVersion}`))
      }
      catch (e) {
        console.error(e)
        console.log(chalk.red(`% Failed to publish ${pkg.targetName}`))
        console.log()
        errors.push(e)
      }
    }
    console.log()
  }
  catch (e) {
    console.error(e)
    console.log(chalk.red(`% Failed to publish ${job.task.publishName}`))
    console.log()
    errors.push(e)
  }

  return {
    remoteManifest,
    cloneResult,
    job,
    errors,
  }
}

export async function publishSingle({ dir, packageJSON }: PackageInfo, { publishTag, task }: KnightlyJob, dryRun = false) {
  // remove all scripts
  await fs.writeJSON(path.join(dir, 'package.json'), { ...packageJSON, scripts: {} }, { spaces: 2 })

  // publish
  run(`npm publish --access public --tag ${publishTag} ${dryRun ? '--dry-run' : ''}`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
  if (publishTag === task.defaultBranch && !dryRun)
    run(`npm dist-tag add ${packageJSON.name}@${publishTag} latest`, dir, { NODE_AUTH_TOKEN: NPM_TOKEN! })
}

export async function runPublishTasks(tasks: KnightlyTask[] | KnightlyTask) {
  if (!Array.isArray(tasks))
    tasks = [tasks]

  const result: JobResult[] = []

  for (const task of tasks) {
    const jobs = await resolveTasks(task)

    for (const job of jobs)
      result.push(await runPublishJob(job))
  }
  return result
}
