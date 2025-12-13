import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';
import { API_CONFIG } from '../config/api.config';
import { axiosInstance as axios } from '../utils/api';

export default function Login() {
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { guestLogin, setUser, setToken } = useAuth();
  const navigate = useNavigate();
  const isAndroid = Capacitor.isNativePlatform();
  const [searchParams] = useSearchParams();
  
  const apiUrlInputRef = useRef(null);

  useEffect(() => {
    if (isAndroid) {
      const savedApiUrl = localStorage.getItem('apiUrl');
      if (savedApiUrl) {
        setApiUrl(savedApiUrl);
      } else {
        setApiUrl(API_CONFIG.API_URL);
      }
    }
  }, [isAndroid]);

  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    const error = searchParams.get('error');
    
    if (error === 'oauth_failed') {
      setError('第三方登录失败，请重试');
    } else if (token && provider) {
      // 保存 token
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // 获取用户信息
      axios.get('/api/user/me')
        .then(response => {
          const user = response.data;
          localStorage.setItem('user', JSON.stringify(user));
          
          // 更新 AuthContext 状态
          if (setUser && setToken) {
            setUser(user);
            setToken(token);
          }
          
          // 设置安全 cookie（如果在 HTTPS 环境）
          if (window.location.protocol === 'https:') {
            document.cookie = `token=${token}; path=/; secure; samesite=strict`;
          }
          
          navigate('/files');
        })
        .catch(() => {
          setError('获取用户信息失败，请重新登录');
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        });
    }
  }, [searchParams, navigate, setUser, setToken]);

  const handleApiUrlChange = (e) => {
    const value = e.target.value;
    setApiUrl(value);
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

  const handleOAuthLogin = (provider) => {
    if (isAndroid) {
      const currentApiUrl = apiUrlInputRef.current?.value || apiUrl;
      if (!currentApiUrl.trim()) {
        setError('请先配置 API 地址');
        return;
      }
      localStorage.setItem('apiUrl', currentApiUrl.trim());
      window.location.href = `${currentApiUrl}/api/auth/${provider}`;
    } else {
      window.location.href = `${API_CONFIG.API_URL}/api/auth/${provider}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-taiji-white via-taiji-gray-100 to-taiji-gray-200 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
        <TaijiLogo size={800} animate={true} className="absolute -top-40 -left-40" />
        <TaijiLogo size={600} animate={true} className="absolute -bottom-20 -right-20" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="bg-taiji-white rounded-3xl shadow-2xl p-8 border-2 border-taiji-gray-200">
          <div className="flex flex-col items-center mb-8">
            <TaijiLogo size={100} animate={false} />
            <h1 className="text-3xl font-bold text-taiji-black mt-4">太极</h1>
            <p className="text-taiji-gray-500 mt-2">文件传输系统</p>
          </div>

          {isAndroid && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-taiji-black mb-2">
                API 地址
              </label>
              <input
                ref={apiUrlInputRef}
                type="text"
                defaultValue={apiUrl}
                onChange={handleApiUrlChange}
                className="input-field"
                placeholder="例如: http://192.168.0.100:5000"
              />
              <p className="text-xs text-taiji-gray-400 mt-1">
                请输入您的后端服务器地址
              </p>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-4">
            <p className="text-center text-sm text-taiji-gray-600 mb-4">选择登录方式</p>
            
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-taiji-gray-200 rounded-xl bg-taiji-white hover:bg-taiji-gray-50 text-taiji-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </motion.button>

              <motion.button
                type="button"
                onClick={() => handleOAuthLogin('qq')}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-taiji-gray-200 rounded-xl bg-taiji-white hover:bg-taiji-gray-50 text-taiji-black font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <path d="M824.8 613.2c-16-51.4-34.4-94.6-62.7-165.3C766.5 262.2 689.3 112 511.5 112 331.7 112 256.2 265.2 261 447.9c-28.4 70.8-46.7 113.7-62.7 165.3-34 109.5-23 154.8-14.6 155.8 18 2.2 70.1-82.4 70.1-82.4 0 49 25.2 112.9 79.8 159-26.4 8.1-85.7 29.9-71.6 53.8 11.4 19.3 196.2 12.3 249.5 6.3 53.3 6 238.1 13 249.5-6.3 14.1-23.8-45.3-45.7-71.6-53.8 54.6-46.2 79.8-110.1 79.8-159 0 0 52.1 84.6 70.1 82.4 8.5-1.1 19.5-46.4-14.5-155.8z" fill="#12B7F5"/>
                </svg>
                QQ
              </motion.button>
            </div>

            {!isAndroid && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-taiji-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-taiji-white text-taiji-gray-500">或</span>
                  </div>
                </div>

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
              </>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-taiji-gray-200">
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