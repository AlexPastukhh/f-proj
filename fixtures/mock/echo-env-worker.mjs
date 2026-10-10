let raw = ''
for await (const chunk of process.stdin) raw += chunk
const input = raw ? JSON.parse(raw) : {}
process.stdout.write(JSON.stringify({ value: process.env.FEATURE_PROJECTION_TEST_ENV, input }))
