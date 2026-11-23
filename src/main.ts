import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { setupSwagger } from './common/config/swagger';
import { configureCors } from './common/config/cors.config';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptor';
import { SanitizeLoggerInterceptor } from './common/interceptors/sanitize-logger.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// BigInt serializatsiyasi uchun global patch
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason as { message?: string } | undefined;
  console.error('Kutilmagan asinxron xatolik (server to\'xtashi oldi olindi):', err?.message || reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('Kutilmagan tizim xatoligi (server to\'xtashi oldi olindi):', err.message);
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Rasm va ma'lumotlar uchun o'lcham chegarasi (DoS hujumlaridan himoya)
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));

  // Gzip compression - katta javoblarni siqish orqali tarmoqni yengillashtirish
  app.use(compression({ threshold: 1024 }));

  // Xavfsizlik sarlavhalari (server turini yashirish, XSS va sniffing dan himoya)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      hidePoweredBy: true,
      noSniff: true,
      xssFilter: true,
    }),
  );

  // Global Interceptor va Filterlar
  app.useGlobalInterceptors(
    new BigIntInterceptor(),
    new SanitizeLoggerInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // /api prefiksi bilan kelgan so'rovlarni avtomatik to'g'rilash (moslashuvchanlik uchun)
  app.use((req: any, res: any, next: any) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '');
    }
    next();
  });

  // Validatsiya sozlamalari
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // CORS sozlamasi
  configureCors(app);

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  // Swagger hujjatlashtirish
  setupSwagger(app);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Server ishga tushdi: http://localhost:${port}`);
  logger.log(`Swagger hujjati: http://localhost:${port}/swagger`);
}

bootstrap();
