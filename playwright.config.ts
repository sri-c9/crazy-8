import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Run tests sequentially since server has shared in-memory state
  workers: 1,
  // Retry once for WebSocket timing flakiness
  retries: 1,
  // Test timeout
  timeout: 30000,

  use: {
    baseURL: 'http://localhost:3000',
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    // Capture video on failure
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start server before running tests.
  // Use a short turn-skip grace period so disconnect tests don't wait the full
  // production window (30s) for a turn to auto-advance.
  webServer: {
    command: 'bun run build && TURN_SKIP_GRACE_MS=3000 bun start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
