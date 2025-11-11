import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

