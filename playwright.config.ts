import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 45_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/dev.mjs', url: 'http://127.0.0.1:1420', reuseExistingServer: false,
    env: { STYLEDNA_DATA_DIR: '.styledna-dev/e2e' }, timeout: 60_000,
  },
})
