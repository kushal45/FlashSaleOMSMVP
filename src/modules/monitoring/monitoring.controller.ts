import { Controller, Get, Post } from '@nestjs/common';
import { MetricsService } from '../../common/metrics/metrics.service';
import { MetricsData } from '../../common/interfaces/metrics.interface';
import { BenchmarkReport } from '../../common/metrics/metrics.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('metrics')
  async getMetrics(): Promise<MetricsData> {
    return this.metricsService.getMetrics();
  }

  @Get('benchmark')
  async getBenchmarkReport(): Promise<BenchmarkReport> {
    return this.metricsService.generateBenchmarkReport();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('metrics/clear')
  async clearMetrics() {
    await this.metricsService.clearMetrics();
    return { success: true, message: 'Metrics cleared successfully' };
  }
}