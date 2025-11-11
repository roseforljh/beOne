#!/usr/bin/env node

/**
 * WebSocket连接测试脚本
 * 用于验证域名访问时的WebSocket连接是否正常
 */

const { io } = require('socket.io-client');

console.log('🔍 WebSocket连接测试脚本');
console.log('================================');

// 测试配置
const testConfigs = [
  {
    name: 'IP地址访问',
    url: 'http://localhost:5000',
    description: '测试通过IP:端口访问的连接'
  },
  {
    name: '域名访问',
    url: 'https://one.everytalk.cc',
    description: '测试通过域名访问的连接'
  }
];

// 测试函数
async function testConnection(config) {
  console.log(`\n📡 测试: ${config.name}`);
  console.log(`URL: ${config.url}`);
  console.log(`描述: ${config.description}`);
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const socket = io(config.url, {
      auth: { token: 'test_token' },
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: false
    });

    const timeout = setTimeout(() => {
      socket.disconnect();
      resolve({
        success: false,
        error: '连接超时',
        duration: Date.now() - startTime
      });
    }, 10000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      console.log(`✅ 连接成功 (耗时: ${duration}ms)`);
      
      socket.disconnect();
      resolve({
        success: true,
        duration: duration
      });
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      console.log(`❌ 连接失败: ${error.message} (耗时: ${duration}ms)`);
      
      resolve({
        success: false,
        error: error.message,
        duration: duration
      });
    });
  });
}

// 运行测试
async function runTests() {
  const results = [];
  
  for (const config of testConfigs) {
    const result = await testConnection(config);
    results.push({
      ...config,
      ...result
    });
  }
  
  // 输出测试结果摘要
  console.log('\n📊 测试结果摘要');
  console.log('================================');
  
  results.forEach(result => {
    const status = result.success ? '✅ 成功' : '❌ 失败';
    console.log(`${status} | ${result.name}`);
    if (!result.success) {
      console.log(`     错误: ${result.error}`);
    }
    console.log(`     耗时: ${result.duration}ms`);
  });
  
  // 检查是否有失败的测试
  const hasFailures = results.some(r => !r.success);
  
  if (hasFailures) {
    console.log('\n⚠️  部分测试失败，请检查以下项目:');
    console.log('   1. 确保服务器正在运行');
    console.log('   2. 检查防火墙设置');
    console.log('   3. 验证SSL证书配置（如果使用HTTPS）');
    console.log('   4. 确认Nginx配置正确');
  } else {
    console.log('\n🎉 所有测试通过！');
  }
  
  console.log('\n💡 修复建议:');
  console.log('   - 如果域名访问失败但IP访问成功，请检查DNS解析');
  console.log('   - 如果HTTPS连接失败，请检查SSL证书配置');
  console.log('   - 如果WebSocket连接失败，请检查Nginx代理配置');
}

// 运行测试
runTests().catch(console.error);