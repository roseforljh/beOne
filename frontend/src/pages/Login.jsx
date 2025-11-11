import { useState, useEffect, useRef } from 'react';
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
  
  // 使用 useRef 来直接引用输入框
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const apiUrlInputRef = useRef(null);
  
  // 输入法组合状态管理
  const [isComposingUsername, setIsComposingUsername] = useState(false);
  const [isComposingPassword, setIsComposingPassword] = useState(false);
  const [isComposingApiUrl, setIsComposingApiUrl] = useState(false);

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

  // 处理用户名输入
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    console.log('用户名输入:', value);
    setUsername(value);
  };

  // 处理密码输入
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    console.log('密码输入:', value);
    setPassword(value);
  };

  // 处理API地址输入
  const handleApiUrlChange = (e) => {
    const value = e.target.value;
    console.log('API地址输入:', value);
    setApiUrl(value);
  };

  // 用户名输入法组合开始
  const handleUsernameCompositionStart = () => {
    console.log('用户名输入法组合开始');
    setIsComposingUsername(true);
  };

  // 用户名输入法组合结束
  const handleUsernameCompositionEnd = (e) => {
    console.log('用户名输入法组合结束:', e.target.value);
    setIsComposingUsername(false);
    setUsername(e.target.value);
  };

  // 密码输入法组合开始
  const handlePasswordCompositionStart = () => {
    console.log('密码输入法组合开始');
    setIsComposingPassword(true);
  };

  // 密码输入法组合结束
  const handlePasswordCompositionEnd = (e) => {
    console.log('密码输入法组合结束:', e.target.value);
    setIsComposingPassword(false);
    setPassword(e.target.value);
  };

  // API地址输入法组合开始
  const handleApiUrlCompositionStart = () => {
    console.log('API地址输入法组合开始');
    setIsComposingApiUrl(true);
  };

  // API地址输入法组合结束
  const handleApiUrlCompositionEnd = (e) => {
    console.log('API地址输入法组合结束:', e.target.value);
    setIsComposingApiUrl(false);
    setApiUrl(e.target.value);
  };

  // 添加用户名输入框失焦处理
  const handleUsernameBlur = (e) => {
    console.log('用户名输入框失焦:', e.target.value);
    // 确保用户名状态正确
    setUsername(e.target.value);
  };

  // 添加密码输入框聚焦处理
  const handlePasswordFocus = () => {
    console.log('密码输入框聚焦, 当前用户名:', username);
    // 确保用户名输入框的值与状态一致
    if (usernameInputRef.current && usernameInputRef.current.value !== username) {
      console.log('修复用户名输入框值:', usernameInputRef.current.value, '->', username);
      usernameInputRef.current.value = username;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 从 ref 获取当前值，而不是从状态
    const currentUsername = usernameInputRef.current?.value || '';
    const currentPassword = passwordInputRef.current?.value || '';
    const currentApiUrl = apiUrlInputRef.current?.value || '';

    console.log('提交表单:', { username: currentUsername, password: currentPassword, apiUrl: currentApiUrl });

    // 在安卓端,先保存 API 地址
    if (isAndroid) {
      if (!currentApiUrl.trim()) {
        setError('请输入 API 地址');
        setLoading(false);
        return;
      }
      localStorage.setItem('apiUrl', currentApiUrl.trim());
    }

    const result = await login(currentUsername, currentPassword);

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
                  ref={apiUrlInputRef}
                  type="text"
                  defaultValue={apiUrl}
                  onChange={handleApiUrlChange}
                  onCompositionStart={handleApiUrlCompositionStart}
                  onCompositionEnd={handleApiUrlCompositionEnd}
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
                ref={usernameInputRef}
                type="text"
                defaultValue={username}
                onChange={handleUsernameChange}
                onCompositionStart={handleUsernameCompositionStart}
                onCompositionEnd={handleUsernameCompositionEnd}
                onBlur={handleUsernameBlur}
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
                ref={passwordInputRef}
                type="password"
                defaultValue={password}
                onChange={handlePasswordChange}
                onCompositionStart={handlePasswordCompositionStart}
                onCompositionEnd={handlePasswordCompositionEnd}
                onFocus={handlePasswordFocus}
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

