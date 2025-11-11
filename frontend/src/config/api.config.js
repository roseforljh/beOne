/**
 * API 配置文件
 * 
 * 注意: 此文件会在运行 npm start 时自动生成
 * 手动修改的内容会被覆盖
 * 
 * 如需自定义配置,请修改项目根目录的 deploy-simple.js
 */

// 动态获取API配置
const getApiConfig = () => {
  // 检查是否在开发环境
  const isDevelopment = window.location.port === '5173' ||
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    return {
      API_URL: 'http://localhost:5000',
      IS_DEBUG_MODE: true,
      AUTO_DETECTED_IP: 'localhost'
    };
  } else {
    // 生产环境：使用与当前页面相同的协议和主机
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const isHttps = protocol === 'https:';
    
    return {
      API_URL: isHttps ? `https://${hostname}` : `http://${hostname}:5000`,
      IS_DEBUG_MODE: false,
      AUTO_DETECTED_IP: hostname
    };
  }
};

const config = getApiConfig();

export const API_CONFIG = {
  API_URL: config.API_URL
};

export const IS_DEBUG_MODE = config.IS_DEBUG_MODE;
export const AUTO_DETECTED_IP = config.AUTO_DETECTED_IP;