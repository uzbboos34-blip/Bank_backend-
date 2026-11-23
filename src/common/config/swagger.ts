import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import expressBasicAuth from 'express-basic-auth';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Undiruv Yordamchisi API')
  .setDescription(
    'Bank qarzdorlarini boshqarish, Excel yuklash, qaydlar va holatlarni belgilash tizimi',
  )
  .setVersion('1.0.0')
  .addServer('http://localhost:3000', 'Local server')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT tokenni kiriting',
    },
    'bearer',
  )
  .build();

export function setupSwagger(app: INestApplication): void {
  const swaggerUser = process.env.SWAGGER_USER || 'bank_admin';
  const swaggerPass = process.env.SWAGGER_PASS || 'bank_admin_pass2026';

  // BasicAuth orqali Swagger hujjati himoyalanadi
  app.use(
    ['/swagger', '/swagger-json'],
    expressBasicAuth({
      challenge: true,
      users: { [swaggerUser]: swaggerPass },
    }),
  );

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('swagger', app, document, {
    swaggerOptions: {
      filter: true,
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
