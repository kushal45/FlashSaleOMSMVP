import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { InventoryService } from './inventory.service';
import { CreateProductDto, UpdateProductDto } from './dto/inventory.dto';

@Controller('inventory')
@UseGuards(ThrottlerGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async getAllProducts() {
    return this.inventoryService.getAllProducts();
  }

  @Get('metrics')
  async getInventoryMetrics() {
    return this.inventoryService.getInventoryMetrics();
  }

  @Get(':id')
  async getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.inventoryService.getProductInventory(id);
  }

  @Post()
  async createProduct(
    @Body(new ValidationPipe()) createProductDto: CreateProductDto,
  ) {
    return this.inventoryService.createProduct(createProductDto);
  }

  @Put(':id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe()) updateProductDto: UpdateProductDto,
  ) {
    return this.inventoryService.updateProduct(id, updateProductDto);
  }
}