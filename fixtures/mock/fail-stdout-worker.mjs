import fs from 'node:fs'
fs.readFileSync(0, 'utf8')
process.stdout.write('synthetic worker stdout failure detail')
process.exit(1)
