import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('workers/dotnet/runtime')
const required = [
  'FeatureProjection.DotNetWorker.dll',
  'FeatureProjection.DotNetWorker.deps.json',
  'FeatureProjection.DotNetWorker.runtimeconfig.json',
  'Microsoft.CodeAnalysis.CSharp.dll',
  'Microsoft.CodeAnalysis.Workspaces.MSBuild.dll',
  'xunit.v3.core.dll',
]
const missing = required.filter(name => !fs.existsSync(path.join(root, name)))
if (missing.length) {
  console.error(`Packaged .NET worker is incomplete. Missing: ${missing.join(', ')}`)
  console.error('Run: npm run prepare:dotnet-worker')
  process.exit(1)
}
const files = fs.readdirSync(root, { recursive:true })
console.log(`Packaged .NET worker ready: ${root} (${files.length} entries)`)
