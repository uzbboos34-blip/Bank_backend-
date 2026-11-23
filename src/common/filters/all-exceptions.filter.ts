import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Kutilmagan server xatoligi yuz berdi';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'object' && res !== null && 'message' in res
          ? (res as { message: string | string[] }).message
          : exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          const target = (exception.meta?.target as string[])?.join(', ') || 'maydon';
          message = `Bunday ma'lumot allaqachon mavjud (${target})`;
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          message = 'So\'ralgan ma\'lumot topilmadi';
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          message = 'Bog\'langan ma\'lumotlar xatosi (Foreign key constraint)';
          break;
        }
        default: {
          status = HttpStatus.BAD_REQUEST;
          message = `Ma'lumotlar bazasi xatosi (${exception.code})`;
          break;
        }
      }
    } else if (exception instanceof Error) {
      // Shaxsiy ma'lumotlarni o'z ichiga olmaydigan umumiy xatolik stacki
      this.logger.error(`Ichki xatolik: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
