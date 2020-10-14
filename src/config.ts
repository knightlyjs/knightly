import { Octokit } from '@octokit/rest'

export const CI = process.env.CI
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN
export const KNIGHTLY_DEBUG = process.env.KNIGHTLY_DEBUG
export const NPM_TOKEN = process.env.NODE_AUTH_TOKEN || process.env.NPM_AUTH_TOKEN || process.env.NPM_TOKEN

export const octokit = new Octokit({
  auth: GITHUB_TOKEN,
})
