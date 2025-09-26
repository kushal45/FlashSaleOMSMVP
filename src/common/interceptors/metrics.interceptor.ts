import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const method = request.method;
    const url = request.url;
    const route = request.route?.path || url;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        // Record request metrics
        this.recordRequestMetrics(method, route, statusCode, duration).catch(
          (err) => {
            console.error('Error recording request metrics:', err);
          },
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        // Record error metrics
        this.recordRequestMetrics(method, route, statusCode, duration, error);
        throw error;
      }),
    );
  }

  private async recordRequestMetrics(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    error?: any,
  ): Promise<void> {
    try {
      // Record request latency
      await this.metricsService.recordRequestLatency(
        method,
        route,
        statusCode,
        duration,
      );

      // Record request count
      await this.metricsService.recordRequestCount(method, route, statusCode);

      // Record error if present
      if (error) {
        await this.metricsService.recordError(
          method,
          route,
          error.name || 'UnknownError',
        );
      }

      // Update throughput
      await this.metricsService.updateThroughput();
    } catch (metricsError) {
      // Don't let metrics errors break the application
      console.error('Failed to record metrics:', metricsError);
    }
  }
}
