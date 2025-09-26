import { IsNumber, IsString, IsPositive, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNumber()
  @IsPositive()
  productId: number;

  @IsString()
  userId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;
}

export class OrderResponseDto {
  jobId: string;
  orderId: number;
  queuePosition: number;
  estimatedWaitTime: number;
}
