#!/usr/bin/env node

const { io } = require('socket.io-client');
const axios = require('axios');

// Simple color functions for compatibility
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

class WebSocketValidator {
  constructor() {
    this.socket = null;
    this.testResults = [];
    this.baseUrl = 'http://localhost:3001';
    this.wsUrl = 'ws://localhost:3001';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const typeColors = {
      success: colors.green,
      error: colors.red,
      info: colors.blue,
      warning: colors.yellow
    };
    
    console.log(`[${timestamp}] ${typeColors[type]('●')} ${message}`);
  }

  async runTest(testName, testFn) {
    this.log(`Running test: ${testName}`, 'info');
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.push({ name: testName, status: 'PASS', duration });
      this.log(`✅ ${testName} - PASSED (${duration}ms)`, 'success');
    } catch (error) {
      this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
      this.log(`❌ ${testName} - FAILED: ${error.message}`, 'error');
    }
  }

  async testBackendHealth() {
    const response = await axios.get(`${this.baseUrl}/api/v1/monitoring/health`);
    if (response.status !== 200) {
      throw new Error(`Health check failed with status ${response.status}`);
    }
    if (response.data.status !== 'ok') {
      throw new Error(`Health check returned status: ${response.data.status}`);
    }
  }

  async testMetricsEndpoint() {
    const response = await axios.get(`${this.baseUrl}/api/v1/monitoring/metrics`);
    if (response.status !== 200) {
      throw new Error(`Metrics endpoint failed with status ${response.status}`);
    }
    if (!response.data.timestamp) {
      throw new Error('Metrics response missing timestamp');
    }
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.socket = io(this.wsUrl);
      
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.log(`Connected to WebSocket with ID: ${this.socket.id}`, 'success');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection error: ${error.message}`));
      });
    });
  }

  async testMetricsSubscription() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Metrics subscription timeout'));
      }, 10000);

      this.socket.emit('subscribe-metrics');
      
      this.socket.once('metrics-update', (data) => {
        clearTimeout(timeout);
        if (!data || typeof data !== 'object') {
          reject(new Error('Invalid metrics data received'));
          return;
        }
        
        this.log(`Received metrics: queueLength=${data.queueLength}, activeConnections=${data.activeConnections}`, 'info');
        resolve(data);
      });
    });
  }

  async testCustomFetchTotalOrders() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Fetch total orders timeout'));
      }, 5000);

      this.socket.emit('fetch-total-orders');
      
      this.socket.once('fetch-total-orders', (data) => {
        clearTimeout(timeout);
        if (!data || typeof data.totalOrders === 'undefined') {
          reject(new Error('Invalid total orders data received'));
          return;
        }
        
        this.log(`Received total orders: ${data.totalOrders}`, 'info');
        resolve(data);
      });
    });
  }

  async testCustomFetchInventoryUpdates() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Fetch inventory updates timeout'));
      }, 5000);

      this.socket.emit('fetch-inventory-updates');
      
      this.socket.once('fetch-inventory-updates', (data) => {
        clearTimeout(timeout);
        if (!data || !Array.isArray(data.products)) {
          reject(new Error('Invalid inventory data received'));
          return;
        }
        
        this.log(`Received inventory updates: ${data.products.length} products`, 'info');
        resolve(data);
      });
    });
  }

  async testBenchmarkReport() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Benchmark report timeout'));
      }, 5000);

      this.socket.emit('get-benchmark-report');
      
      this.socket.once('benchmark-report', (data) => {
        clearTimeout(timeout);
        if (!data || typeof data !== 'object') {
          reject(new Error('Invalid benchmark report data received'));
          return;
        }
        
        this.log(`Received benchmark report: ${JSON.stringify(data, null, 2)}`, 'info');
        resolve(data);
      });

      this.socket.once('benchmark-error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Benchmark report error: ${error.message}`));
      });
    });
  }

  async testWebSocketDisconnection() {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }

      this.socket.on('disconnect', () => {
        this.log('WebSocket disconnected successfully', 'success');
        resolve();
      });

      this.socket.disconnect();
      
      // Fallback in case disconnect event doesn't fire
      setTimeout(resolve, 1000);
    });
  }

  async validateDataIntegrity(metricsData) {
    // Validate metrics data structure
    const requiredFields = ['timestamp', 'queueLength', 'activeConnections'];
    for (const field of requiredFields) {
      if (!(field in metricsData)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate data types
    if (typeof metricsData.timestamp !== 'number') {
      throw new Error('timestamp should be a number');
    }
    if (typeof metricsData.queueLength !== 'number') {
      throw new Error('queueLength should be a number');
    }
    if (typeof metricsData.activeConnections !== 'number') {
      throw new Error('activeConnections should be a number');
    }

    // Validate reasonable ranges
    if (metricsData.activeConnections < 0) {
      throw new Error('activeConnections should be non-negative');
    }
    if (metricsData.queueLength < 0) {
      throw new Error('queueLength should be non-negative');
    }
  }

  async runAllTests() {
    console.log(colors.bold(colors.blue('\n🚀 Starting WebSocket Validation Tests\n')));
    
    try {
      // Test backend health
      await this.runTest('Backend Health Check', () => this.testBackendHealth());
      
      // Test metrics endpoint
      await this.runTest('Metrics Endpoint Test', () => this.testMetricsEndpoint());
      
      // Test WebSocket connection
      await this.runTest('WebSocket Connection Test', () => this.testWebSocketConnection());
      
      // Test metrics subscription
      let metricsData;
      await this.runTest('Metrics Subscription Test', async () => {
        metricsData = await this.testMetricsSubscription();
      });
      
      // Test data integrity
      if (metricsData) {
        await this.runTest('Data Integrity Validation', () => this.validateDataIntegrity(metricsData));
      }
      
      // Test custom fetch total orders
      await this.runTest('Custom Fetch Total Orders Test', () => this.testCustomFetchTotalOrders());
      
      // Test custom fetch inventory updates
      await this.runTest('Custom Fetch Inventory Updates Test', () => this.testCustomFetchInventoryUpdates());
      
      // Test benchmark report
      await this.runTest('Benchmark Report Test', () => this.testBenchmarkReport());
      
      // Test WebSocket disconnection
      await this.runTest('WebSocket Disconnection Test', () => this.testWebSocketDisconnection());
      
    } catch (error) {
      this.log(`Unexpected error during tests: ${error.message}`, 'error');
    }

    this.printSummary();
  }

  printSummary() {
    console.log(colors.bold(colors.blue('\n📊 Test Results Summary\n')));
    
    const passed = this.testResults.filter(r => r.status === 'PASS');
    const failed = this.testResults.filter(r => r.status === 'FAIL');
    
    console.log(`${colors.green('✅ Passed:')} ${passed.length}`);
    console.log(`${colors.red('❌ Failed:')} ${failed.length}`);
    console.log(`${colors.blue('📈 Total:')} ${this.testResults.length}\n`);
    
    if (failed.length > 0) {
      console.log(colors.bold(colors.red('Failed Tests:')));
      failed.forEach(test => {
        console.log(`  ${colors.red('●')} ${test.name}: ${test.error}`);
      });
      console.log('');
    }
    
    if (passed.length > 0) {
      console.log(colors.bold(colors.green('Passed Tests:')));
      passed.forEach(test => {
        console.log(`  ${colors.green('●')} ${test.name} (${test.duration}ms)`);
      });
      console.log('');
    }
    
    const overallStatus = failed.length === 0 ? 'PASSED' : 'FAILED';
    const statusColor = failed.length === 0 ? colors.green : colors.red;
    
    console.log(colors.bold(statusColor(`🎯 Overall Status: ${overallStatus}\n`)));
    
    if (failed.length === 0) {
      console.log(colors.green('🎉 All WebSocket functionality is working correctly!\n'));
    } else {
      console.log(colors.red('🔧 Some tests failed. Please check the backend configuration.\n'));
      process.exit(1);
    }
  }
}

// Run the validation
const validator = new WebSocketValidator();
validator.runAllTests().catch(error => {
  console.error(colors.red(`Fatal error: ${error.message}`));
  process.exit(1);
});