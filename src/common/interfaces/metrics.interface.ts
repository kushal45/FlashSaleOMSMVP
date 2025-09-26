export interface MetricsData {
  successfulOrders: number;
  failedOrders: number;
  pendingOrders: number;
  queueLength: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
  averageProcessingTime: number;
  inventoryLevels: Record<string, number>;
  timestamp: number;
  ordersPerSecond: number;
}

export interface RequestMetrics {
  count: number;
  totalLatency: number;
  errors: number;
}

export interface ProductMetrics {
  stock: number;
  reserved: number;
}
