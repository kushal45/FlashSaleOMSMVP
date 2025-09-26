import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInitialTables1726056820000 implements MigrationInterface {
  name = 'CreateInitialTables1726056820000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create products table
    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'initial_stock',
            type: 'integer',
          },
          {
            name: 'current_stock',
            type: 'integer',
          },
          {
            name: 'price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'flash_sale_active',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Create orders table
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'product_id',
            type: 'int',
          },
          {
            name: 'quantity',
            type: 'integer',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'confirmed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },

          {
            name: 'reserved_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'job_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['product_id'],
            referencedTableName: 'products',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indexes for better performance
    await queryRunner.createIndex(
      'products',
      new TableIndex({
        name: 'idx_products_flash_sale_active',
        columnNames: ['flash_sale_active'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_product_id',
        columnNames: ['product_id'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'idx_orders_created_at',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes first
    await queryRunner.dropIndex('orders', 'idx_orders_created_at');
    await queryRunner.dropIndex('orders', 'idx_orders_status');
    await queryRunner.dropIndex('orders', 'idx_orders_product_id');
    await queryRunner.dropIndex('orders', 'idx_orders_user_id');
    await queryRunner.dropIndex('products', 'idx_products_flash_sale_active');

    // Drop tables
    await queryRunner.dropTable('orders');
    await queryRunner.dropTable('products');
  }
}
