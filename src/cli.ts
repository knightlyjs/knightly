/* eslint-disable no-unused-expressions */
import fs from 'fs-extra'
import yargs from 'yargs'
import YAML from 'js-yaml'
import chalk from 'chalk'
import { KnightlyTask } from './types'
import { resolveTasks, runPublishJob, version } from '.'

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

      let tasks: KnightlyTask[] | KnightlyTask = args.config.match(/.ya?ml$/i)
        ? YAML.load(await fs.readFile(args.config, 'utf-8'))
        : JSON.parse(await fs.readFile(args.config, 'utf-8'))

      if (!Array.isArray(tasks))
        tasks = [tasks]

      for (const task of tasks) {
        const jobs = await resolveTasks(task)

        for (const job of jobs) {
          const r = await runPublishJob(job, args['dry-run'])
          if (r && r.errors.length)
            process.exit(1)
        }
      }
    },
  )
  .showHelpOnFail(false)
  .help()
  .argv
