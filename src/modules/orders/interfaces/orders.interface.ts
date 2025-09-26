export interface QueueStatus {
  jobId: string;
  status: string;
  progress: number;
  queuePosition: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
}

export interface OrderMetrics {
  totalOrders: number;
  confirmedOrders: number;
  failedOrders: number;
  pendingOrders: number;
  queueStats: Record<string, number>;
}

export interface OrderQueueJobData {
  orderId: number;
  productId: number;
  userId: string;
  quantity: number;
  timestamp: number;
  currentStock: number;
}
