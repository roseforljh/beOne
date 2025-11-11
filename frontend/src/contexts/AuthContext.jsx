import { createContext, useContext, useState, useEffect } from 'react';
import { axiosInstance as axios } from '../utils/api';

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
    // 从 localStorage 恢复登录状态（健壮性：防止 JSON.parse('undefined')/'null' 触发白屏）
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
        // 仅在明确是有效 JSON 时再解析
        setUser(JSON.parse(savedUser));
        // 设置 axios 默认 header（统一使用 axiosInstance）
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      } else {
        // 发现损坏或占位字符串，立即清理，避免后续解析
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('恢复登录状态失败:', error);
      // 清除可能损坏的数据
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      const { token: newToken, user: newUser } = response.data;
      
      setToken(newToken);
      setUser(newUser);
      
      // 保存到 localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // 设置 axios 默认 header（统一使用 axiosInstance）
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
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
      const response = await axios.post('/api/auth/guest-login');
      const { token: newToken, user: newUser } = response.data;
      
      setToken(newToken);
      setUser(newUser);
      
      // 保存到 localStorage
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      // 设置 axios 默认 header（统一使用 axiosInstance）
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
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
  };

  return (
    <AuthContext.Provider value={{ user, token, login, guestLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

