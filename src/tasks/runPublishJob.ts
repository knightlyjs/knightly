import pacote from 'pacote'
import chalk from 'chalk'
import { octokit } from '../config'
import { CloneResult, KnightlyJob } from '../types'
import { rewritePackage, rewritePackageVersion } from '../rewrites'
import { clone, install, build } from '../operations'
import { publish } from '../operations/publish'

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
  catch { }

  try {
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
  }
  catch (e) {
    console.log(chalk.red(`% Failed to fetch ${job.owner}/${job.repo} at ${job.branch || job.pr}`))
    console.log()
    return
  }

  console.log(`- Cloning ${chalk.green(`${job.owner}/${job.repo} ${job.branch ? `-b ${job.branch}` : ''}`)} ${job.pr ? chalk.magenta(`(#${job.pr})`) : ''}`)

  try {
    cloneResult = await clone(job)
  }
  catch (e) {
    console.error(e)
    console.log(chalk.red(`% Failed to clone ${job.owner}/${job.repo} at ${job.branch || job.pr}`))
    console.log()
    return
  }

  try {
    console.log(`- Building ${job.task.owner}/${job.task.repo}`)

    console.log('- Packages')
    for (const pkg of cloneResult.packages)
      console.log(`  | ${pkg.originalName} -> ${chalk.green(pkg.targetName)} ${chalk.gray(`(${pkg.dir})`)}`)
    console.log()

    for (const pkg of cloneResult.packages)
      await rewritePackageVersion(pkg)

    await install(cloneResult)

    if (!job.task.buildForEach)
      await build(cloneResult.root, cloneResult.packageJSON, job)

    for (const pkg of cloneResult.packages)
      await rewritePackage(pkg, cloneResult, job)

    for (const pkg of cloneResult.packages) {
      try {
        if (job.task.buildForEach)
          await build(pkg.dir, pkg.packageJSON, job)

        await publish(pkg, job, dryRun)
        console.log(chalk.green(`- Published ${pkg.targetName} @${pkg.targetVersion}`))
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
