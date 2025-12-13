#!/usr/bin/env node

/**
 * 认证问题调试脚本
 * 用于诊断HTTPS环境下的认证失败问题
 */

const axios = require('axios');
const jwt = require('jsonwebtoken');

console.log('🔍 认证问题调试脚本');
console.log('================================');

// 配置
const BASE_URL = 'https://one.everytalk.cc';
const JWT_SECRET = 'taiji_secret_key_change_in_production';

async function testAuthFlow() {
  try {
    console.log('\n📡 测试API连接...');
    
    // 1. 测试健康检查
    console.log('\n1. 测试健康检查...');
    const healthResponse = await axios.get(`${BASE_URL}/api/health`, {
      timeout: 10000
    });
    console.log('✅ 健康检查成功:', healthResponse.data);
    
    // 2. 测试游客登录
    console.log('\n2. 测试游客登录...');
    const guestLoginResponse = await axios.post(`${BASE_URL}/api/auth/guest-login`, {}, {
      timeout: 10000
    });
    
    const { token, user } = guestLoginResponse.data;
    console.log('✅ 游客登录成功:', {
      userId: user.id,
      username: user.username,
      isGuest: user.is_guest,
      tokenPreview: token.substring(0, 30) + '...'
    });
    
    // 3. 验证Token
    console.log('\n3. 验证Token...');
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token验证成功:', {
        id: decoded.id,
        username: decoded.username,
        isGuest: decoded.is_guest
      });
    } catch (err) {
      console.error('❌ Token验证失败:', err.message);
      return;
    }
    
    // 4. 测试认证API请求
    console.log('\n4. 测试认证API请求...');
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    try {
      const conversationsResponse = await axios.get(`${BASE_URL}/api/conversations`, {
        headers: authHeaders,
        timeout: 10000
      });
      console.log('✅ 认证API请求成功:', conversationsResponse.data);
    } catch (error) {
      console.error('❌ 认证API请求失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      // 如果是403错误，分析原因
      if (error.response?.status === 403) {
        console.log('\n🔍 403错误分析:');
        console.log('- 检查Authorization头是否正确发送');
        console.log('- 检查后端JWT_SECRET是否匹配');
        console.log('- 检查Token是否过期');
        console.log('- 检查HTTPS环境下的请求头传递');
      }
    }
    
    // 5. 测试WebSocket连接
    console.log('\n5. 测试WebSocket连接...');
    const { io } = require('socket.io-client');
    
    const socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      timeout: 10000,
      reconnection: false
    });
    
    await new Promise((resolve) => {
      socket.on('connect', () => {
        console.log('✅ WebSocket连接成功');
        socket.disconnect();
        resolve();
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket连接失败:', error.message);
        resolve();
      });
      
      // 超时处理
      setTimeout(() => {
        console.error('❌ WebSocket连接超时');
        socket.disconnect();
        resolve();
      }, 10000);
    });
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

// 检查环境
function checkEnvironment() {
  console.log('\n🌍 环境检查:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Node.js版本: ${process.version}`);
  console.log(`BASE_URL: ${BASE_URL}`);
  console.log(`JWT_SECRET: ${JWT_SECRET.substring(0, 10)}...`);
  
  // 检查网络连接
  console.log('\n🌐 网络连接测试:');
  const https = require('https');
  const req = https.request(BASE_URL, (res) => {
    console.log(`✅ HTTPS连接成功 (状态码: ${res.statusCode})`);
    testAuthFlow();
  });
  
  req.on('error', (err) => {
    console.error('❌ HTTPS连接失败:', err.message);
    console.log('\n💡 可能的解决方案:');
    console.log('1. 检查域名是否正确解析');
    console.log('2. 检查SSL证书是否有效');
    console.log('3. 检查防火墙设置');
    console.log('4. 检查服务器是否运行');
  });
  
  req.end();
}

// 运行检查
checkEnvironment();