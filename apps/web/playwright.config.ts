import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real web app and API with DEVELOPMENT MOCK providers
 * (DEV_MOCK_PROVIDERS=true), so no external API quota is used and every report is
 * marked "simulated". Run `pnpm build` first, then `pnpm test:e2e`.
 * CHROMIUM_PATH can point at a system Chromium when Playwright's browser download is unavailable.
 */
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    launchOptions: executablePath
      ? {
          executablePath,
          args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
        }
      : {},
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        ...(executablePath
          ? {
              launchOptions: {
                executablePath,
                args: ['--no-sandbox', '--disable-gpu', '--single-process', '--no-zygote'],
              },
            }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'node dist/main.js',
      cwd: '../api',
      url: 'http://127.0.0.1:4100/api/health',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        DEV_MOCK_PROVIDERS: 'true',
        API_PORT: '4100',
        DATABASE_URL: '',
        VIRUSTOTAL_API_KEY: '',
        AI_PROVIDER: 'none',
        FRONTEND_URL: 'http://localhost:3100',
        ANALYSIS_RATE_LIMIT_PER_HOUR: '1000',
      },
    },
    {
      command: 'node node_modules/next/dist/bin/next start --port 3100',
      url: 'http://localhost:3100/guide-index.json',
      reuseExistingServer: false,
      env: { API_INTERNAL_URL: 'http://127.0.0.1:4100' },
    },
  ],
});
