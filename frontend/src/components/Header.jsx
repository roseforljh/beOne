import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from './TaijiLogo';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header({ fixed = true }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={`${fixed ? 'fixed top-0 left-0 right-0' : 'w-full'} z-50 border-b border-taiji-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="max-w-7xl mx-auto px-3 md:px-4 py-1.5 md:py-3"
        style={{
          paddingLeft: 'calc(0.75rem + env(safe-area-inset-left))',
          paddingRight: 'calc(0.75rem + env(safe-area-inset-right))',
        }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <TaijiLogo size={28} animate={false} />
            <div className="leading-tight">
              <h1 className="text-sm md:text-lg font-bold text-taiji-black">太极</h1>
              <p className="hidden sm:block text-xs text-taiji-gray-500">
                {user?.is_guest ? '👤 游客模式' : user ? '文件传输' : '欢迎使用'}
              </p>
            </div>
          </Link>

          {user ? (
            <>
              {/* 桌面端导航 */}
              <nav className="hidden md:flex items-center gap-4 lg:gap-6">
                <Link
                  to="/public"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/public'
                      ? 'text-taiji-black'
                      : 'text-taiji-gray-500 hover:text-taiji-black'
                  }`}
                >
                  🌐 公共
                </Link>
                <Link
                  to="/files"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/files'
                      ? 'text-taiji-black'
                      : 'text-taiji-gray-500 hover:text-taiji-black'
                  }`}
                >
                  📁 文件
                </Link>
                <Link
                  to="/chat"
                  className={`text-sm font-medium transition-colors ${
                    location.pathname === '/chat'
                      ? 'text-taiji-black'
                      : 'text-taiji-gray-500 hover:text-taiji-black'
                  }`}
                >
                  💬 对话
                </Link>

                <div className="flex items-center gap-2 lg:gap-3 pl-4 lg:pl-6 border-l border-taiji-gray-300">
                  <span className="text-xs lg:text-sm text-taiji-gray-600 hidden lg:inline">{user.username}</span>
                  <Link
                    to="/settings"
                    className="text-xs lg:text-sm px-3 lg:px-4 py-2 border border-taiji-gray-300 text-taiji-black rounded-lg hover:bg-taiji-gray-100 transition-colors"
                  >
                    ⚙️ 设置
                  </Link>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={logout}
                    className="text-xs lg:text-sm px-3 lg:px-4 py-2 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors"
                  >
                    退出
                  </motion.button>
                </div>
              </nav>

              {/* 移动端菜单按钮 */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-taiji-black"
                aria-label="打开菜单"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </>
          ) : (
            <>
              {/* 桌面端登录按钮 */}
              <Link
                to="/login"
                className="hidden md:block text-xs lg:text-sm px-3 lg:px-4 py-2 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors"
              >
                登录
              </Link>
              
              {/* 移动端登录按钮 - 保持与菜单按钮相同的尺寸 */}
              <Link
                to="/login"
                className="md:hidden p-2 text-taiji-black"
                aria-label="登录"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </Link>
            </>
          )}
        </div>

        {/* 移动端下拉菜单 */}
        <AnimatePresence>
          {user && mobileMenuOpen && (
            <motion.nav
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-3 space-y-2">
                <Link
                  to="/public"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    location.pathname === '/public'
                      ? 'bg-taiji-black text-taiji-white'
                      : 'text-taiji-gray-700 hover:bg-taiji-gray-100'
                  }`}
                >
                  🌐 公共文件
                </Link>
                <Link
                  to="/files"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    location.pathname === '/files'
                      ? 'bg-taiji-black text-taiji-white'
                      : 'text-taiji-gray-700 hover:bg-taiji-gray-100'
                  }`}
                >
                  📁 我的文件
                </Link>
                <Link
                  to="/chat"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    location.pathname === '/chat'
                      ? 'bg-taiji-black text-taiji-white'
                      : 'text-taiji-gray-700 hover:bg-taiji-gray-100'
                  }`}
                >
                  💬 对话板
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    location.pathname === '/settings'
                      ? 'bg-taiji-black text-taiji-white'
                      : 'text-taiji-gray-700 hover:bg-taiji-gray-100'
                  }`}
                >
                  ⚙️ 设置
                </Link>

                <div className="pt-3 border-t border-taiji-gray-200 flex items-center justify-between px-4">
                  <span className="text-sm text-taiji-gray-600">{user.username}</span>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="px-4 py-2 bg-taiji-black text-taiji-white rounded-lg text-sm font-medium"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

