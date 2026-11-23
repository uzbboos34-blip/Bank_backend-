import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Decimal } from '@prisma/client/runtime/library';

function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === 'bigint') {
    return val.toString();
  }
  if (val instanceof Decimal) {
    return val.toString();
  }
  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = serializeValue(v);
    }
    return res;
  }
  return val;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeValue(data)));
  }
}
