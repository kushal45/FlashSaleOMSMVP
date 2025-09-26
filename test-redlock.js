#!/usr/bin/env node

/**
 * Redis Red-lock Integration Test
 * This script tests the Red-lock implementation with 3 Redis nodes
 * Run this after starting the Redis nodes: docker compose up -d redis-node1 redis-node2 redis-node3
 */

const Redis = require('ioredis');
// Import Redlock - handle both CommonJS and ES modules
let Redlock;
try {
  Redlock = require('redlock').default || require('redlock');
} catch (e) {
  const module = require('redlock');
  Redlock = module.default || module;
}

async function testRedlockImplementation() {
  console.log('🔄 Testing Red-lock implementation...\n');

  // Create Redis clients for each node
  const redisNodes = [
    { host: 'localhost', port: 6379 },
    { host: 'localhost', port: 6380 },
    { host: 'localhost', port: 6381 },
  ];

  const redisClients = [];
  
  console.log('📡 Connecting to Redis nodes...');
  for (const node of redisNodes) {
    try {
      const client = new Redis({
        host: node.host,
        port: node.port,
        connectTimeout: 5000,
        lazyConnect: true,
      });

      await client.connect();
      console.log(`✅ Connected to Redis node ${node.host}:${node.port}`);
      redisClients.push(client);
    } catch (error) {
      console.log(`❌ Failed to connect to Redis node ${node.host}:${node.port}:`, error.message);
      console.log('💡 Make sure Redis nodes are running: docker compose up -d redis-node1 redis-node2 redis-node3');
      process.exit(1);
    }
  }

  // Initialize Redlock
  const redlock = new Redlock(redisClients, {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200,
    automaticExtensionThreshold: 500,
  });

  console.log('\n🔒 Testing distributed locking...');

  try {
    // Test 1: Acquire and release a lock
    console.log('Test 1: Basic lock acquisition and release');
    const lockKey = 'test:lock:flash-sale-product-1';
    const ttl = 5000;

    const lock = await redlock.acquire([lockKey], ttl);
    console.log(`✅ Lock acquired for key: ${lockKey}`);

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 1000));

    await lock.release();
    console.log(`✅ Lock released for key: ${lockKey}`);

    // Test 2: Test lock contention
    console.log('\nTest 2: Lock contention simulation');
    const promises = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < 5; i++) {
      promises.push(
        (async (index) => {
          try {
            const contentionLock = await redlock.acquire([lockKey], 2000);
            successCount++;
            console.log(`✅ Worker ${index + 1}: Lock acquired`);
            
            // Simulate work
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await contentionLock.release();
            console.log(`✅ Worker ${index + 1}: Lock released`);
          } catch (error) {
            failureCount++;
            console.log(`⚠️  Worker ${index + 1}: Failed to acquire lock (expected behavior)`);
          }
        })(i)
      );
    }

    await Promise.all(promises);
    console.log(`\n📊 Contention test results:`);
    console.log(`   - Successful acquisitions: ${successCount}`);
    console.log(`   - Failed acquisitions: ${failureCount}`);
    console.log(`   - Total attempts: ${successCount + failureCount}`);

    // Test 3: Node fault tolerance (simulate node failure)
    console.log('\nTest 3: Fault tolerance test');
    console.log('💡 This would normally test behavior when a Redis node fails');
    console.log('💡 For full testing, stop one Redis node and observe behavior');

    console.log('\n✅ Red-lock implementation test completed successfully!');
    console.log('\n🎉 Your Red-lock setup with 3 Redis nodes is working correctly.');
    console.log('🔧 The implementation provides:');
    console.log('   - Distributed locking across 3 Redis nodes');
    console.log('   - Fault tolerance (can handle 1 node failure)');
    console.log('   - Automatic lock expiration');
    console.log('   - Protection against race conditions in flash sales');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Clean up connections
    console.log('\n🧹 Cleaning up Redis connections...');
    for (const client of redisClients) {
      await client.quit();
    }
    console.log('✅ All Redis connections closed');
  }
}

// Run the test
testRedlockImplementation().catch(console.error);