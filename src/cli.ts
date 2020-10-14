/* eslint-disable no-unused-expressions */
import fs from 'fs-extra'
import yargs from 'yargs'
import YAML from 'js-yaml'
import chalk from 'chalk'
import { KnightlyUserConfig, resolveTasks, resolveUserConfig, runPublishJob, version } from '.'

yargs
  .scriptName('knightly')
  .usage('$0 [args]')
  .command(
    '*',
    'Analysis bundle cost for each export of a package',
    (args) => {
      return args
        .positional('config', {
          type: 'string',
          alias: 'c',
          default: 'knightly.yml',
          describe: 'config file path',
        })
        .positional('dry-run', {
          type: 'boolean',
          alias: 'd',
        })
    },
    async(args) => {
      console.log(`${chalk.blue('Knightly ')}${chalk.cyan(`v${version}`)}\n`)

      let configs = YAML.safeLoad(await fs.readFile(args.config, 'utf-8')) as (KnightlyUserConfig[] | KnightlyUserConfig)
      if (!Array.isArray(configs))
        configs = [configs]

      const tasks = resolveUserConfig(configs)

      for (const task of tasks) {
        const jobs = await resolveTasks(task)

        for (const job of jobs) {
          const { errors } = await runPublishJob(job, args['dry-run'])
          if (errors.length)
            process.exit(1)
        }
      }
    },
  )
  .showHelpOnFail(false)
  .help()
  .argv
