import { KnightlyTask, JobResult } from '../types'
import { resolveTasks } from './resolveTasks'
import { runPublishJob } from './runPublishJob'

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
