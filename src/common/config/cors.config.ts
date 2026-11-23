import { INestApplication, Logger } from '@nestjs/common';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

export function configureCors(app: INestApplication): void {
  const logger = new Logger('CorsConfig');
  const isDevelopment =
    process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  const envCors = process.env.CORS_ORIGIN;
  const customOrigins =
    envCors && envCors !== '*'
      ? envCors.split(',').map((domain) => domain.trim())
      : [];

  const allOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...customOrigins]);

  app.enableCors({
    origin: (origin, callback) => {
      if (isDevelopment || envCors === '*') {
        return callback(null, true);
      }

      if (!origin || origin === 'null') {
        return callback(null, true);
      }

      if (allOrigins.has(origin)) {
        return callback(null, true);
      }

      logger.warn(`CORS bloklandi: ${origin}`);
      return callback(new Error('CORS tomonidan rad etildi'), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  logger.log(
    isDevelopment
      ? 'CORS: Development rejimida yoqildi'
      : `CORS: ${allOrigins.size} ta ruxsat berilgan domen bilan yoqildi`,
  );
}
