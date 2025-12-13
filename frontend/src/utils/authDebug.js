/**
 * 认证调试工具
 * 用于诊断HTTPS环境下的认证问题
 */

import { axiosInstance as axios } from './api';

export const authDebug = {
  // 测试当前token
  async testCurrentToken() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    console.log('🔍 [Auth Debug] 当前认证状态检查');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Token存在:', !!token);
    console.log('Token长度:', token?.length || 0);
    console.log('Token预览:', token ? token.substring(0, 50) + '...' : 'none');
    console.log('用户数据:', user ? JSON.parse(user) : null);
    console.log('Axios默认头部:', axios.defaults.headers.common.Authorization);
    
    if (!token) {
      console.error('❌ 没有找到token，请先登录');
      return false;
    }
    
    try {
      // 测试token验证端点
      console.log('\n📡 测试token验证...');
      const response = await axios.post('/api/auth/debug-token', { token });
      console.log('✅ Token验证成功:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Token验证失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        requestHeaders: error.config?.headers
      });
      return false;
    }
  },
  
  // 测试游客登录流程
  async testGuestLogin() {
    console.log('\n🔍 [Auth Debug] 测试游客登录流程');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
      // 清除现有认证
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common.Authorization;
      
      console.log('📝 执行游客登录...');
      const response = await axios.post('/api/auth/guest-login');
      const { token, user } = response.data;
      
      console.log('✅ 游客登录成功:', {
        userId: user.id,
        username: user.username,
        isGuest: user.is_guest,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 50) + '...'
      });
      
      // 保存到localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      
      // 测试新token
      return await this.testCurrentToken();
    } catch (error) {
      console.error('❌ 游客登录失败:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      return false;
    }
  },
  
  // 测试API请求
  async testApiRequests() {
    console.log('\n🔍 [Auth Debug] 测试API请求');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ 没有token，无法测试API请求');
      return false;
    }
    
    const tests = [
      { name: '获取会话列表', url: '/api/conversations', method: 'GET' },
      { name: '创建新会话', url: '/api/conversations', method: 'POST', data: { title: '测试会话' } }
    ];
    
    let allPassed = true;
    
    for (const test of tests) {
      try {
        console.log(`\n📡 测试: ${test.name}`);
        const config = {
          method: test.method,
          url: test.url
        };
        
        if (test.data) {
          config.data = test.data;
        }
        
        const response = await axios(config);
        console.log(`✅ ${test.name}成功:`, response.data);
      } catch (error) {
        console.error(`❌ ${test.name}失败:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          headers: error.config?.headers
        });
        allPassed = false;
      }
    }
    
    return allPassed;
  },
  
  // 测试WebSocket连接
  async testWebSocketConnection() {
    console.log('\n🔍 [Auth Debug] 测试WebSocket连接');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ 没有token，无法测试WebSocket连接');
      return false;
    }
    
    return new Promise((resolve) => {
      const { io } = require('socket.io-client');
      
      const socket = io(window.location.origin, {
        auth: { token },
        transports: ['websocket'],
        timeout: 10000,
        reconnection: false
      });
      
      socket.on('connect', () => {
        console.log('✅ WebSocket连接成功');
        socket.disconnect();
        resolve(true);
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ WebSocket连接失败:', error.message);
        resolve(false);
      });
      
      setTimeout(() => {
        console.error('❌ WebSocket连接超时');
        socket.disconnect();
        resolve(false);
      }, 10000);
    });
  },
  
  // 运行完整诊断
  async runFullDiagnosis() {
    console.log('🏥 [Auth Debug] 开始完整认证诊断');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('当前URL:', window.location.href);
    console.log('当前协议:', window.location.protocol);
    console.log('当前主机:', window.location.host);
    
    const results = {
      tokenValid: false,
      guestLoginWorks: false,
      apiRequestsWork: false,
      webSocketWorks: false
    };
    
    // 1. 测试当前token
    results.tokenValid = await this.testCurrentToken();
    
    // 2. 如果当前token无效，测试游客登录
    if (!results.tokenValid) {
      results.guestLoginWorks = await this.testGuestLogin();
    } else {
      results.guestLoginWorks = true;
    }
    
    // 3. 测试API请求
    if (results.guestLoginWorks) {
      results.apiRequestsWork = await this.testApiRequests();
    }
    
    // 4. 测试WebSocket连接
    if (results.guestLoginWorks) {
      results.webSocketWorks = await this.testWebSocketConnection();
    }
    
    // 输出诊断结果
    console.log('\n📊 [Auth Debug] 诊断结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(results).forEach(([key, value]) => {
      const status = value ? '✅ 通过' : '❌ 失败';
      console.log(`${status} ${key}`);
    });
    
    const allPassed = Object.values(results).every(Boolean);
    if (allPassed) {
      console.log('\n🎉 所有测试通过！认证系统正常工作。');
    } else {
      console.log('\n⚠️ 部分测试失败，请检查上述错误信息。');
    }
    
    return results;
  }
};

// 导出到全局，方便在浏览器控制台使用
if (typeof window !== 'undefined') {
  window.authDebug = authDebug;
}