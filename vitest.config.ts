import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts', 'src/**/*.test.ts', 'worker/**/*.test.ts', 'lib/**/*.test.ts'],
    environment: 'node',
  },
})
