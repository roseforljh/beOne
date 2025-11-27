import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 全局健壮性补丁：清理 LocalStorage 中潜在的损坏数据
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
    // 忽略异常
  }
})();

// 全局错误处理 - 防止未捕获的错误导致白屏
window.addEventListener('error', () => {});
window.addEventListener('unhandledrejection', () => {});

// 延迟加载非关键模块（性能监控工具）
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    import('./utils/memoryMonitor.js');
    import('./utils/networkMonitor.js');
  });
} else {
  setTimeout(() => {
    import('./utils/memoryMonitor.js');
    import('./utils/networkMonitor.js');
  }, 2000);
}

// 延迟注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }, 1000);
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

