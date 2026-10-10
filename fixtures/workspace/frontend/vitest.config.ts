import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['src/**/*.feature.test.ts'],
    includeTaskLocation: true,
    taskTitleValueFormatTruncate: 1024,
  },
})
