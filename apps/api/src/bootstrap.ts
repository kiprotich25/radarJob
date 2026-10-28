import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule, type AppOverrides } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import type { Env } from './config/env';

function trustProxyValue(v: string): boolean | number | string {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

/** Create and configure the Nest application (shared by main.ts and integration tests). */
export async function createApp(
  env: Env,
  overrides: AppOverrides = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(env, overrides), {
    bodyParser: false,
    logger: env.NODE_ENV === 'test' ? false : undefined,
  });
  app.set('trust proxy', trustProxyValue(env.TRUST_PROXY));
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '32kb' });

  app.use(
    helmet({
      // The API only serves JSON; nothing should ever be rendered or framed.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: env.NODE_ENV === 'production',
    }),
  );
  const origins = env.FRONTEND_URL.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['content-type'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  return app;
}
