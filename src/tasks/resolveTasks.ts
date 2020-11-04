import { paramCase } from 'param-case'
import { octokit } from '../config'
import { KnightlyJob, KnightlyTask } from '../types'

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
