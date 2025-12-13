import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { axiosInstance as axios } from '../utils/api';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUsernameEdit, setShowUsernameEdit] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const isGuest = user?.is_guest;
  const isOAuthUser = user?.oauth_provider;

  useEffect(() => {
    const successParam = searchParams.get('success');
    const errorParam = searchParams.get('error');
    const provider = searchParams.get('provider');

    if (successParam === 'rebind_success') {
      setSuccess(`成功换绑到 ${getProviderName(provider)} 账号！`);
      updateUser();
      navigate('/settings', { replace: true });
    } else if (errorParam) {
      const errorMessages = {
        'oauth_failed': 'OAuth登录失败',
        'invalid_state': '无效的请求',
        'bind_failed': '换绑失败，请重试',
        'invalid_action': '无效的操作'
      };
      setError(errorMessages[errorParam] || '操作失败');
      navigate('/settings', { replace: true });
    }
  }, [searchParams, navigate, updateUser]);

  const handleUnbind = async () => {
    if (!confirm('确定要解绑当前第三方账号吗？解绑后您需要重新登录。')) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.post('/api/user/unbind-oauth');
      setSuccess('账号已解绑，正在退出登录...');
      
      setTimeout(() => {
        logout();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || '解绑失败');
    }

    setLoading(false);
  };

  const handleRebind = async (provider) => {
    if (!confirm(`确定要换绑到 ${getProviderName(provider)} 账号吗？`)) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await axios.get(`/api/user/rebind-oauth/${provider}`);
      window.location.href = response.data.url;
    } catch (err) {
      setError(err.response?.data?.error || '换绑失败');
      setLoading(false);
    }
  };

  const handleUsernameChange = async () => {
    if (!newUsername || newUsername.trim().length < 2) {
      setError('用户名至少需要2个字符');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.patch('/api/user/username', { newUsername: newUsername.trim() });
      setSuccess('用户名修改成功！');
      setShowUsernameEdit(false);
      setNewUsername('');
      await updateUser();
    } catch (err) {
      setError(err.response?.data?.error || '修改失败');
    }

    setLoading(false);
  };

  const getProviderIcon = (provider) => {
    switch (provider) {
      case 'google':
        return '🌐';
      case 'github':
        return '🐙';
      case 'qq':
        return '🐧';
      default:
        return '🔗';
    }
  };

  const getProviderName = (provider) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'github':
        return 'GitHub';
      case 'qq':
        return 'QQ';
      default:
        return '第三方平台';
    }
  };

  return (
    <div className="min-h-screen bg-taiji-gray-100">
      <Header />

      <main
        className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-8"
        style={{ paddingTop: 'calc(60px + env(safe-area-inset-top))' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-taiji-black mb-2">账号设置</h1>
            <p className="text-sm md:text-base text-taiji-gray-500">
              管理您的账号信息
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4"
            >
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm mb-4"
            >
              {success}
            </motion.div>
          )}

          {isGuest ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 p-8 text-center"
            >
              <div className="mb-6">
                <TaijiLogo size={80} animate={true} />
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-taiji-black mb-4">
                👤 游客模式
              </h2>
              <p className="text-taiji-gray-600 mb-6">
                游客账号是临时账号，无法修改账号信息。
                <br />
                如需完整功能，请退出游客模式并使用正式账号登录。
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={logout}
                className="px-6 py-3 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors font-medium"
              >
                退出游客模式
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* 用户名卡片 */}
              <div className="bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 p-6 md:p-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <TaijiLogo size={60} animate={true} />
                    <div>
                      <p className="text-sm text-taiji-gray-600">用户名</p>
                      {showUsernameEdit ? (
                        <input
                          type="text"
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder={user?.username}
                          className="mt-1 px-3 py-2 border border-taiji-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-taiji-black"
                        />
                      ) : (
                        <p className="text-xl font-bold text-taiji-black">
                          {user?.username}
                        </p>
                      )}
                    </div>
                  </div>
                  {!showUsernameEdit ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setShowUsernameEdit(true);
                        setNewUsername(user?.username || '');
                      }}
                      className="px-4 py-2 bg-taiji-black text-taiji-white rounded-lg hover:bg-taiji-gray-800 transition-colors text-sm font-medium"
                    >
                      修改
                    </motion.button>
                  ) : (
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleUsernameChange}
                        disabled={loading}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        保存
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setShowUsernameEdit(false);
                          setNewUsername('');
                        }}
                        className="px-4 py-2 bg-taiji-gray-300 text-taiji-black rounded-lg hover:bg-taiji-gray-400 transition-colors text-sm font-medium"
                      >
                        取消
                      </motion.button>
                    </div>
                  )}
                </div>
                {user?.email && (
                  <p className="text-sm text-taiji-gray-600 ml-16">
                    📧 {user.email}
                  </p>
                )}
              </div>

              {/* OAuth账号卡片 */}
              <div className="bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 p-6 md:p-8">
                <h3 className="text-lg font-bold text-taiji-black mb-4">第三方账号绑定</h3>
                
                {isOAuthUser ? (
                  <div className="space-y-4">
                    <div className="bg-taiji-gray-100 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">
                            {getProviderIcon(user.oauth_provider)}
                          </span>
                          <div>
                            <p className="text-sm text-taiji-gray-600">当前绑定</p>
                            <p className="text-lg font-bold text-taiji-black">
                              {getProviderName(user.oauth_provider)}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          已绑定
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm text-taiji-gray-600">
                        可以换绑到同平台的另一个账号，或切换到其他平台
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          onClick={() => handleRebind('google')}
                          disabled={loading}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                            user.oauth_provider === 'google'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white border-2 border-taiji-gray-300 hover:border-taiji-black'
                          }`}
                        >
                          🌐 {user.oauth_provider === 'google' ? '换绑 Google' : '切换到 Google'}
                        </motion.button>
                        <motion.button
                          onClick={() => handleRebind('qq')}
                          disabled={loading}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`py-3 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                            user.oauth_provider === 'qq'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-white border-2 border-taiji-gray-300 hover:border-taiji-black'
                          }`}
                        >
                          🐧 {user.oauth_provider === 'qq' ? '换绑 QQ' : '切换到 QQ'}
                        </motion.button>
                      </div>
                      
                      <motion.button
                        onClick={handleUnbind}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {loading ? '解绑中...' : '解绑账号'}
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-taiji-gray-600 text-sm mb-4">
                      绑定第三方账号后，可以使用该账号快速登录
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <motion.button
                        onClick={() => handleRebind('google')}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="py-3 bg-white border-2 border-taiji-gray-300 rounded-lg hover:border-taiji-black transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        🌐 绑定 Google
                      </motion.button>
                      <motion.button
                        onClick={() => handleRebind('qq')}
                        disabled={loading}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="py-3 bg-white border-2 border-taiji-gray-300 rounded-lg hover:border-taiji-black transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        🐧 绑定 QQ
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}