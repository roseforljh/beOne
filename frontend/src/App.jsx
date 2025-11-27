import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// 路由懒加载 - 按需加载页面组件
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Chat = lazy(() => import('./pages/Chat'));
const Public = lazy(() => import('./pages/Public'));
const Settings = lazy(() => import('./pages/Settings'));

// 根路径重定向组件
function RootRedirect() {
  const { user, loading } = useAuth();
  const isAndroid = Capacitor.isNativePlatform();

  if (loading) {
    return <LoadingSpinner message="加载中..." />;
  }

  // 安卓端：未登录时进入登录页，已登录进入文件页
  if (isAndroid) {
    return user ? <Navigate to="/files" replace /> : <Navigate to="/login" replace />;
  }

  // Web 端：进入公开页面
  return <Navigate to="/public" replace />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="加载中..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function LoginRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner message="加载中..." />;
  }

  if (user) {
    return <Navigate to="/files" replace />;
  }

  return children;
}

function App() {
  // 设置状态栏样式
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // 设置状态栏为深色内容(黑色文字),适配浅色背景
      StatusBar.setStyle({ style: Style.Light });
      // 设置状态栏背景色为白色
      StatusBar.setBackgroundColor({ color: '#FFFFFF' });
      
      // 强制使用原生 Resize 模式，防止 Capacitor 插件干预布局
      Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingSpinner message="加载中..." />}>
            <Routes>
            {/* 根路径根据平台重定向 */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* 公共页面 */}
            <Route path="/public" element={<Public />} />
            
            {/* 登录页面 */}
            <Route
              path="/login"
              element={
                <LoginRoute>
                  <Login />
                </LoginRoute>
              }
            />
            
            {/* 需要登录的页面 */}
            <Route
              path="/files"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            
              {/* 其他路径重定向 */}
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

