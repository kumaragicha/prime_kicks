import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { corsOptions } from './common/cors';
import { LoggingInterceptor } from './common/logging.interceptor';

async function bootstrap() {
  // rawBody: keeps the exact request bytes on req.rawBody — Meta's webhook
  // signature (X-Hub-Signature-256) is an HMAC of the raw payload, not parsed JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Log every request/response across ALL endpoints for debugging.
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableCors(corsOptions());
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 API ready on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
