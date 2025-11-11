import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';
import { API_CONFIG } from '../config/api.config';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();
  const isAndroid = Capacitor.isNativePlatform();

  // 从 localStorage 恢复 API 地址
  useEffect(() => {
    if (isAndroid) {
      const savedApiUrl = localStorage.getItem('apiUrl');
      if (savedApiUrl) {
        setApiUrl(savedApiUrl);
      } else {
        // 使用配置文件中的默认值
        setApiUrl(API_CONFIG.API_URL);
      }
    }
  }, [isAndroid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 在安卓端,先保存 API 地址
    if (isAndroid) {
      if (!apiUrl.trim()) {
        setError('请输入 API 地址');
        setLoading(false);
        return;
      }
      localStorage.setItem('apiUrl', apiUrl.trim());
    }

    const result = await login(username, password);

    if (result.success) {
      navigate('/files');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    const result = await guestLogin();

    if (result.success) {
      navigate('/public');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-taiji-white via-taiji-gray-100 to-taiji-gray-200 flex items-center justify-center p-4">
      {/* 背景太极图案 */}
      <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
        <TaijiLogo size={800} animate={true} className="absolute -top-40 -left-40" />
        <TaijiLogo size={600} animate={true} className="absolute -bottom-20 -right-20" />
      </div>

      {/* 登录卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-taiji-white rounded-3xl shadow-2xl p-8 border-2 border-taiji-gray-200">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <TaijiLogo size={100} animate={false} />
            <h1 className="text-3xl font-bold text-taiji-black mt-4">太极</h1>
            <p className="text-taiji-gray-500 mt-2">文件传输系统</p>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 安卓端显示 API 地址输入框 */}
            {isAndroid && (
              <div>
                <label className="block text-sm font-medium text-taiji-black mb-2">
                  API 地址
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="input-field"
                  placeholder="例如: http://192.168.0.100:5000"
                  required
                />
                <p className="text-xs text-taiji-gray-400 mt-1">
                  请输入您的后端服务器地址
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-taiji-black mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-taiji-black mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="请输入密码"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <TaijiLogo size={20} animate={true} />
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </motion.button>
          </form>

          {/* 游客模式 - 仅在非安卓端显示 */}
          {!isAndroid && (
            <div className="mt-4">
              <motion.button
                type="button"
                disabled={loading}
                onClick={handleGuestLogin}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <TaijiLogo size={20} animate={true} />
                    进入中...
                  </span>
                ) : (
                  '👤 游客模式'
                )}
              </motion.button>
            </div>
          )}

          {/* 说明 */}
          <div className="mt-6 pt-6 border-t border-taiji-gray-200 space-y-2">
            <p className="text-xs text-taiji-gray-400 text-center">
              默认账号：root / 123456
            </p>
            {!isAndroid && (
              <p className="text-xs text-taiji-gray-400 text-center">
                游客模式：可下载/预览公共文件，使用对话板
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

