import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 导入性能监控工具（仅在移动端自动启动）
import './utils/memoryMonitor.js'
import './utils/networkMonitor.js'

// 全局健壮性补丁：清理 LocalStorage 中潜在的 "undefined"/损坏 JSON，避免第三方库 JSON.parse 崩溃
(() => {
  try {
    const keys = ['user', 'token'];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v === undefined || v === 'undefined' || v === 'null') {
        localStorage.removeItem(k);
        continue;
      }
      if (k === 'user' && typeof v === 'string') {
        try {
          JSON.parse(v);
        } catch {
          localStorage.removeItem(k);
        }
      }
    }
  } catch {
    // 忽略 WebView 特殊环境下的异常
  }
})();

// 全局错误处理 - 防止未捕获的错误导致白屏
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // 不阻止默认行为,让 ErrorBoundary 处理
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // 不阻止默认行为
});

// 注册 Service Worker 以启用缓存
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

// 在非localhost环境下加载认证调试工具
if (window.location.hostname !== 'localhost') {
  import('./utils/authDebug.js').then(() => {
    console.log('🔧 认证调试工具已加载，使用 authDebug.runFullDiagnosis() 运行诊断');
  }).catch((err) => {
    console.warn('认证调试工具加载失败:', err);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

