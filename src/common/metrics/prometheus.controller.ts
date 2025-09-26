import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from '../../common/metrics/metrics.service';
import { MetricsData } from '../interfaces/metrics.interface';

@Controller('metrics')
export class PrometheusController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  async getMetrics(): Promise<string> {
    const metricsData = await this.metricsService.getMetrics();
    const prometheusFormat = this.formatForPrometheus(metricsData);
    return prometheusFormat;
  }

  private formatForPrometheus(metrics: MetricsData): string {
    const lines: string[] = [];

    // Add help and type comments
    lines.push(
      '# HELP flash_sale_orders_total Total number of orders by status',
    );
    lines.push('# TYPE flash_sale_orders_total counter');
    lines.push(
      `flash_sale_orders_total{status="success"} ${metrics.successfulOrders}`,
    );
    lines.push(
      `flash_sale_orders_total{status="failed"} ${metrics.failedOrders}`,
    );
    lines.push(
      `flash_sale_orders_total{status="pending"} ${metrics.pendingOrders}`,
    );

    lines.push('');
    lines.push('# HELP flash_sale_queue_length Current queue length');
    lines.push('# TYPE flash_sale_queue_length gauge');
    lines.push(`flash_sale_queue_length ${metrics.queueLength}`);

    lines.push('');
    lines.push('# HELP flash_sale_throughput Orders processed per second');
    lines.push('# TYPE flash_sale_throughput gauge');
    lines.push(`flash_sale_throughput ${metrics.throughput}`);

    lines.push('');
    lines.push('# HELP flash_sale_error_rate Error rate percentage');
    lines.push('# TYPE flash_sale_error_rate gauge');
    lines.push(`flash_sale_error_rate ${metrics.errorRate}`);

    lines.push('');
    lines.push(
      '# HELP flash_sale_active_connections Current active connections',
    );
    lines.push('# TYPE flash_sale_active_connections gauge');
    lines.push(`flash_sale_active_connections ${metrics.activeConnections}`);

    lines.push('');
    lines.push(
      '# HELP flash_sale_processing_time_avg Average processing time in milliseconds',
    );
    lines.push('# TYPE flash_sale_processing_time_avg gauge');
    lines.push(
      `flash_sale_processing_time_avg ${metrics.averageProcessingTime}`,
    );

    // Add inventory levels
    if (
      metrics.inventoryLevels &&
      Object.keys(metrics.inventoryLevels).length > 0
    ) {
      lines.push('');
      lines.push(
        '# HELP flash_sale_inventory_levels Current inventory levels by product',
      );
      lines.push('# TYPE flash_sale_inventory_levels gauge');

      Object.entries(metrics.inventoryLevels).forEach(([productId, stock]) => {
        lines.push(
          `flash_sale_inventory_levels{product_id="${productId}"} ${stock}`,
        );
      });
    }

    lines.push('');
    return lines.join('\n');
  }
}