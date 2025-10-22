import { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import TaijiLogo from '../components/TaijiLogo';

export default function Settings() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('username');
  
  // 修改用户名
  const [newUsername, setNewUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  // 修改密码
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');

    if (!newUsername.trim() || newUsername.trim().length < 2) {
      setUsernameError('用户名至少需要2个字符');
      return;
    }

    setUsernameLoading(true);

    try {
      const response = await axios.patch('/api/user/username', {
        newUsername: newUsername.trim()
      });

      setUsernameSuccess('用户名修改成功！');
      setNewUsername('');
      
      // 更新本地存储的用户信息
      const updatedUser = { ...user, username: response.data.username };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      setUsernameError(error.response?.data?.error || '修改失败');
    }

    setUsernameLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有字段');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('新密码至少需要6个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      return;
    }

    setPasswordLoading(true);

    try {
      await axios.patch('/api/user/password', {
        currentPassword,
        newPassword
      });

      setPasswordSuccess('密码修改成功！请重新登录');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (error) {
      setPasswordError(error.response?.data?.error || '修改失败');
    }

    setPasswordLoading(false);
  };

  return (
    <div className="min-h-screen bg-taiji-gray-100">
      <Header />

      <main className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-taiji-black mb-2">账号设置</h1>
            <p className="text-sm md:text-base text-taiji-gray-500">管理您的账号信息</p>
          </div>

          <div className="bg-taiji-white rounded-xl md:rounded-2xl shadow-lg border-2 border-taiji-gray-200 overflow-hidden">
            {/* 标签切换 */}
            <div className="flex border-b-2 border-taiji-gray-200">
              <button
                onClick={() => setActiveTab('username')}
                className={`flex-1 px-4 py-3 md:py-4 font-medium transition-colors ${
                  activeTab === 'username'
                    ? 'bg-taiji-black text-taiji-white'
                    : 'text-taiji-gray-600 hover:bg-taiji-gray-100'
                }`}
              >
                修改用户名
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`flex-1 px-4 py-3 md:py-4 font-medium transition-colors ${
                  activeTab === 'password'
                    ? 'bg-taiji-black text-taiji-white'
                    : 'text-taiji-gray-600 hover:bg-taiji-gray-100'
                }`}
              >
                修改密码
              </button>
            </div>

            <div className="p-4 md:p-8">
              {/* 修改用户名 */}
              {activeTab === 'username' && (
                <motion.form
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleUsernameSubmit}
                  className="space-y-4 md:space-y-6"
                >
                  <div className="flex items-center gap-4 p-4 bg-taiji-gray-100 rounded-lg">
                    <TaijiLogo size={40} animate={false} />
                    <div>
                      <p className="text-sm text-taiji-gray-600">当前用户名</p>
                      <p className="text-lg font-bold text-taiji-black">{user?.username}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-taiji-black mb-2">
                      新用户名
                    </label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="input-field"
                      placeholder="输入新用户名"
                      required
                    />
                  </div>

                  {usernameError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
                    >
                      {usernameError}
                    </motion.div>
                  )}

                  {usernameSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm"
                    >
                      {usernameSuccess}
                    </motion.div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={usernameLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {usernameLoading ? '修改中...' : '确认修改'}
                  </motion.button>
                </motion.form>
              )}

              {/* 修改密码 */}
              {activeTab === 'password' && (
                <motion.form
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handlePasswordSubmit}
                  className="space-y-4 md:space-y-6"
                >
                  <div>
                    <label className="block text-sm font-medium text-taiji-black mb-2">
                      当前密码
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="input-field"
                      placeholder="输入当前密码"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-taiji-black mb-2">
                      新密码
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="input-field"
                      placeholder="输入新密码（至少6个字符）"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-taiji-black mb-2">
                      确认新密码
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="input-field"
                      placeholder="再次输入新密码"
                      required
                    />
                  </div>

                  {passwordError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
                    >
                      {passwordError}
                    </motion.div>
                  )}

                  {passwordSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm"
                    >
                      {passwordSuccess}
                    </motion.div>
                  )}

                  <motion.button
                    type="submit"
                    disabled={passwordLoading}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? '修改中...' : '确认修改'}
                  </motion.button>
                </motion.form>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

