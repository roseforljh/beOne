import { createContext, useContext, useState, useEffect } from 'react';
import { axiosInstance as axios, updateApiBaseUrl } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 localStorage 恢复登录状态
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        const isCorrupt =
          savedUser === undefined ||
          savedUser === 'undefined' ||
          savedUser === null ||
          savedUser === 'null';
    
        if (savedToken && savedUser && !isCorrupt) {
          setToken(savedToken);
          axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          
          // 从服务器刷新用户信息（确保获取最新的 oauth_provider 等字段）
          try {
            const response = await axios.get('/api/user/me');
            const freshUser = response.data;
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
          } catch (error) {
            // 如果刷新失败，使用本地存储的用户信息
            console.error('Failed to refresh user info:', error);
            setUser(JSON.parse(savedUser));
          }
          
          if (window.location.protocol === 'https:') {
            document.cookie = `token=${savedToken}; path=/; secure; samesite=strict`;
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      // 更新 API baseURL（如果在安卓端修改了 API 地址）
      updateApiBaseUrl();
      
      const response = await axios.post('/api/auth/login', { username, password });
      const { token: newToken, user: newUser } = response.data;
      
      // 先清除旧状态
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];

      setToken(newToken);
      setUser(newUser);
      
      // 保存到 localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // 设置 axios 默认 header（统一使用 axiosInstance）
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // 在HTTPS环境下设置安全cookie
      if (window.location.protocol === 'https:') {
        document.cookie = `token=${newToken}; path=/; secure; samesite=strict`;
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '登录失败'
      };
    }
  };

  const guestLogin = async () => {
    try {
      // 更新 API baseURL（如果在安卓端修改了 API 地址）
      updateApiBaseUrl();
      
      const response = await axios.post('/api/auth/guest-login');
      const { token: newToken, user: newUser } = response.data;
      
      // 先清除旧状态
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];

      setToken(newToken);
      setUser(newUser);
      
      // 保存到 localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // 设置 axios 默认 header（统一使用 axiosInstance）
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // 在HTTPS环境下设置安全cookie
      if (window.location.protocol === 'https:') {
        document.cookie = `token=${newToken}; path=/; secure; samesite=strict`;
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '游客登录失败'
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    
    // 清除HTTPS环境下的安全cookie
    if (window.location.protocol === 'https:') {
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=strict';
    }
  };

  const updateUser = async () => {
    try {
      const response = await axios.get('/api/user/me');
      const freshUser = response.data;
      setUser(freshUser);
      localStorage.setItem('user', JSON.stringify(freshUser));
    } catch (error) {
      console.error('Failed to update user info:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, setUser, setToken, login, guestLogin, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};