import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class SanitizeLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const { method, originalUrl } = req;
    const startTime = Date.now();

    // DIQQAT: Bank mijozlarining shaxsiy ma'lumotlari (ism, telefon, manzil) logga yozilmaydi!
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        this.logger.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
      }),
    );
  }
}
