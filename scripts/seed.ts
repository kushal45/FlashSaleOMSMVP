import { AppDataSource } from '../typeorm.config';
import { Product } from '../src/database/entities/product.entity';

async function seed() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Database connected!');

    const productRepository = AppDataSource.getRepository(Product);

    console.log('Seeding database...');

    // Create sample products for flash sale
    const products = [
      {
        name: 'iPhone 15 Pro',
        initialStock: 100,
        currentStock: 100,
        price: 999.99,
        flashSaleActive: true,
      },
      {
        name: 'Samsung Galaxy S24',
        initialStock: 150,
        currentStock: 150,
        price: 799.99,
        flashSaleActive: true,
      },
      {
        name: 'MacBook Air M3',
        initialStock: 50,
        currentStock: 50,
        price: 1299.99,
        flashSaleActive: true,
      },
      {
        name: 'Sony WH-1000XM5',
        initialStock: 200,
        currentStock: 200,
        price: 349.99,
        flashSaleActive: false,
      },
      {
        name: 'Apple Watch Series 9',
        initialStock: 75,
        currentStock: 75,
        price: 399.99,
        flashSaleActive: true,
      },
    ];

    for (const productData of products) {
      const product = productRepository.create(productData);
      const savedProduct = await productRepository.save(product);
      console.log(
        `Created product: ${savedProduct.name} (ID: ${savedProduct.id})`,
      );
    }

    console.log('Seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

void seed();
