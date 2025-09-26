import {
  IsNumber,
  IsString,
  IsBoolean,
  IsPositive,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsPositive()
  initialStock: number;

  @IsNumber()
  @IsPositive()
  currentStock: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsBoolean()
  @IsOptional()
  flashSaleActive?: boolean;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  currentStock?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsBoolean()
  @IsOptional()
  flashSaleActive?: boolean;
}

export class ReserveInventoryDto {
  @IsNumber()
  @IsPositive()
  productId: number;

  @IsNumber()
  @IsPositive()
  @Min(1)
  quantity: number;
}
