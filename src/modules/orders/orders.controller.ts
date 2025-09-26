import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { QueueStatus, OrderMetrics } from './interfaces/orders.interface';
import { CreateOrderDto, OrderResponseDto } from './dto/create-order.dto';

@Controller('orders')
@UseGuards(ThrottlerGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async placeOrder(
    @Body(new ValidationPipe()) createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.placeOrder(createOrderDto);
  }

  @Get(':id')
  async getOrderStatus(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.getOrderStatus(id);
  }

  @Get('queue/:jobId')
  async getQueueStatus(@Param('jobId') jobId: string): Promise<QueueStatus> {
    return this.ordersService.getQueueStatus(jobId);
  }

  @Get('user/:userId')
  async getUserOrders(@Param('userId') userId: string) {
    return this.ordersService.getUserOrders(userId);
  }

  @Get('admin/metrics')
  async getOrderMetrics(): Promise<OrderMetrics> {
    return this.ordersService.getOrderMetrics();
  }
}
