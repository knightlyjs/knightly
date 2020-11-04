import dayjs from 'dayjs'
import makeTable from 'markdown-table'
import { PackageInfo, KnightlyJob, CloneResult } from './types'
import { version } from '.'

function getTimestampBadge() {
  return `![${new Date().toISOString()}](https://img.shields.io/date/${Math.round(
    +new Date() / 1000,
  )}?color=eee&label=)`
}

export function generateREADME(
  { packageJSON, originalName, targetName }: PackageInfo,
  { sha, lastMessage, targetVersion }: CloneResult,
  { pr, task, publishTag }: KnightlyJob,
) {
  const now = dayjs()

  const knightlyLink = '[Knightly](https://github.com/knightlyjs/knightly)'
  const headUrl = `https://github.com/${task.owner}/${task.repo}/tree/${sha}`
  const repoLink = `[${task.owner}/${task.repo}@${sha.slice(0, 5)}](${headUrl})`
  const npmRange = `npm:${targetName}${publishTag ? `@${publishTag}` : ''}`
  const compareLink = pr
    ? `//github.com/${task.owner}/${task.repo}/pull/${pr}/files`
    : `//github.com/${task.owner}/${task.repo}/compare/v${packageJSON.version}...${sha}`

  const table: [string, string][] = []

  table.push([`package (\`${originalName}\`)`, `\`${targetName}\``])

  if (pr)
    table.push(['PR', `[#${pr}](//github.com/${task.owner}/${task.repo}/pull/${pr})`])

  table.push([`version (\`${packageJSON.stableVersion}*\`)`, `\`${targetVersion}\``])
  table.push(['last commit', lastMessage])
  table.push([`sha (\`${publishTag || 'HEAD'}\`)`, `\`${sha}\``])
  table.push(['changes', `[compare with last release](${compareLink})`])
  table.push(['build', now.toISOString()])

  return `
# [${originalName}](https://github.com/${task.owner}/${task.repo})

[![Knightly Build](https://github.com/knightlyjs/knightly/blob/main/res/badge.svg?raw=true)](https://github.com/knightlyjs/knightly) ${getTimestampBadge()}

${task.official ? '' : '[**Unofficial**] '}Nightly build for ${repoLink}, published automatically by ${knightlyLink}.

${makeTable(table)}

> [More PRs and branches builds](https://www.npmjs.com/package/${targetName}?activeTab=versions)

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

${task.packagesNameMap ? `
## Packages

${
  makeTable([
    ['Package', 'Knightly'],
    ...Object
      .entries(task.packagesNameMap)
      .map(([name, target]) => [`\`${name}\``, `[\`${target}\`](https://www.npmjs.com/package/${target}/v/${targetVersion})`]),
  ])
}
` : ''}
<br>
Knightly v${version}
`
}
