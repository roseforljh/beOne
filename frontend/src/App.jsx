import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, memo } from 'react';
import { Capacitor } from '@capacitor/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';

// 轻量级加载占位符（避免导入重型组件）
const MinimalLoader = memo(() => (
  <div className="flex items-center justify-center min-h-screen bg-taiji-gray-100">
    <div className="w-12 h-12 border-4 border-taiji-black border-t-transparent rounded-full animate-spin" />
  </div>
));
MinimalLoader.displayName = 'MinimalLoader';

// 路由懒加载 - 按需加载页面组件
const Login = lazy(() => import('./pages/Login'));
const Home = lazy(() => import('./pages/Home'));
const Chat = lazy(() => import('./pages/Chat'));
const Public = lazy(() => import('./pages/Public'));
const Settings = lazy(() => import('./pages/Settings'));

// 预加载关键页面（在空闲时）
const preloadPages = () => {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => {
      import('./pages/Login');
      import('./pages/Home');
    });
  } else {
    setTimeout(() => {
      import('./pages/Login');
      import('./pages/Home');
    }, 1000);
  }
};

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
  const location = window.location;
  const searchParams = new URLSearchParams(location.search);
  
  // 检测 OAuth 回调参数
  const hasOAuthCallback = searchParams.get('token') && searchParams.get('provider');

  if (loading) {
    return <LoadingSpinner message="加载中..." />;
  }

  // 如果是 OAuth 回调,让 Login 页面处理
  if (hasOAuthCallback) {
    return children;
  }

  if (user) {
    return <Navigate to="/files" replace />;
  }

  return children;
}

function App() {
  // 设置状态栏样式和预加载
  useEffect(() => {
    // 预加载关键页面
    preloadPages();
    
    // 移动端特殊配置
    if (Capacitor.isNativePlatform()) {
      // 动态导入 Capacitor 插件，避免阻塞首屏
      Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/keyboard')
      ]).then(([{ StatusBar, Style }, { Keyboard, KeyboardResize }]) => {
        StatusBar.setStyle({ style: Style.Light });
        StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        Keyboard.setResizeMode({ mode: KeyboardResize.Native });
        Keyboard.setScroll({ isDisabled: true });
      }).catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<MinimalLoader />}>
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