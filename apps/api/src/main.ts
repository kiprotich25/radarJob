import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { createApp } from './bootstrap';
import { loadEnv } from './config/env';

async function main() {
  // Load .env in development only; production configuration comes from the environment.
  if (process.env.NODE_ENV !== 'production') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('dotenv').config({ path: ['.env', '../../.env'] });
    } catch {
      /* dotenv is a dev dependency */
    }
  }
  const env = loadEnv();
  if (env.LOG_FORMAT === 'json') Logger.overrideLogger(new ConsoleLogger({ json: true }));
  const app = await createApp(env);
  await app.listen(env.API_PORT, env.API_HOST);

  const log = new Logger('RadarJob');
  log.log(`API listening on http://${env.API_HOST}:${env.API_PORT}/api`);
  if (env.DEV_MOCK_PROVIDERS)
    log.warn('DEV_MOCK_PROVIDERS is ON — reports will be marked SIMULATED.');
  if (!env.VIRUSTOTAL_API_KEY && !env.DEV_MOCK_PROVIDERS)
    log.warn('VIRUSTOTAL_API_KEY not set — reputation checks will report "not configured".');
  if (env.AI_PROVIDER === 'none')
    log.log('AI provider: none — deterministic templates will be used for explanations.');
}

main().catch((e) => {
  // Configuration errors are printed without stack noise.
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
