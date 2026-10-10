import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const input = JSON.parse(fs.readFileSync(0, 'utf8'))
const canonicalExistingPath = value => {
  const resolved = path.resolve(value)
  try { return fs.realpathSync.native(resolved) }
  catch { return resolved }
}
const projectRoot = canonicalExistingPath(input.frameworkProject)
const filters = (input.filters ?? []).map(canonicalExistingPath)
const requireFromHere = createRequire(import.meta.url)
const resolved = requireFromHere.resolve('vitest/node', { paths: [projectRoot] })
const { createVitest } = await import(pathToFileURL(resolved).href)

const vitest = await createVitest({
  root: projectRoot,
  config: input.configFile,
  watch: false,
  includeTaskLocation: true,
  taskTitleValueFormatTruncate: 1024,
})

const output = { cases: [], diagnostics: [] }
try {
  const run = await vitest.collect(filters, { staticParse: false })
  for (const mod of run.testModules) {
    const visit = (collection) => {
      for (const task of collection) {
        if (task.type === 'suite') visit(task.children)
        else if (task.type === 'test') {
          const match = task.name.match(/\s\[situation:([^\]]+)\]\s*$/)
          const line = task.location?.line ?? 0
          const column = task.location?.column ?? 0
          output.cases.push({
            frameworkCaseId: task.id,
            moduleId: mod.moduleId,
            sourceLine: line,
            sourceColumn: column,
            situationId: match?.[1],
            displayName: task.fullName,
          })
        }
      }
    }
    visit(mod.children)
  }
  for (const err of run.unhandledErrors ?? []) output.diagnostics.push({ message: err.message ?? String(err) })
} finally {
  await vitest.close()
}
process.stdout.write(JSON.stringify(output))
