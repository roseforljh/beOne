'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { wsClient } from '@/lib/websocket';
import { useTheme } from '@/components/theme-provider';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Palette, Bell, Shield, Globe, LogOut, User, Lock, AlertCircle } from 'lucide-react';

interface Settings {
  notifications: boolean;
  wifiOnly: boolean;
}

export default function SettingsPage() {
  const { user, logout, setUser } = useAuthStore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [settings, setSettings] = useState<Settings>({ notifications: true, wifiOnly: false });
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [permissionDeniedDialogOpen, setPermissionDeniedDialogOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const saved = localStorage.getItem('synchub-settings');
    if (saved) {
      try { setSettings(JSON.parse(saved)); } catch {}
    }
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('synchub-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (user) {
      setEditUsername(user.username || '');
      setEditEmail(user.email || '');
    }
  }, [user]);

  const handleLogout = () => {
    wsClient.disconnect();
    logout();
    router.push('/login');
  };

  const toggleNotifications = async () => {
    if (settings.notifications) {
      setSettings(prev => ({ ...prev, notifications: false }));
      toast.success('已关闭通知推送');
      return;
    }

    if (!('Notification' in window)) {
      toast.error('您的浏览器不支持通知功能');
      return;
    }

    const currentPermission = Notification.permission;
    
    if (currentPermission === 'granted') {
      setSettings(prev => ({ ...prev, notifications: true }));
      toast.success('已开启通知推送');
      new Notification('SyncHub 通知已开启', { body: '您现在会收到消息通知了', icon: '/favicon.ico' });
    } else if (currentPermission === 'denied') {
      setPermissionDeniedDialogOpen(true);
    } else {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
          setSettings(prev => ({ ...prev, notifications: true }));
          toast.success('已开启通知推送');
          new Notification('SyncHub 通知已开启', { body: '您现在会收到消息通知了', icon: '/favicon.ico' });
        } else if (permission === 'denied') {
          setPermissionDeniedDialogOpen(true);
        } else {
          toast.error('通知权限请求被忽略');
        }
      } catch {
        toast.error('请求通知权限失败');
      }
    }
  };

  const toggleWifiOnly = () => {
    const newValue = !settings.wifiOnly;
    setSettings(prev => ({ ...prev, wifiOnly: newValue }));
    toast.success(newValue ? '已开启仅 Wi-Fi 同步' : '已关闭仅 Wi-Fi 同步');
  };

  const handleSaveProfile = async () => {
    if (!editUsername.trim()) {
      toast.error('用户名不能为空');
      return;
    }

    try {
      const updatedUser = await usersApi.updateMe({
        username: editUsername.trim(),
        email: editEmail.trim() ? editEmail.trim() : null,
      });
      setUser(updatedUser);
      toast.success('个人资料已更新');
      setProfileDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '更新失败');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('新密码至少需要6个字符');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    try {
      const res = await usersApi.changePassword({
        current_password: currentPassword ? currentPassword : null,
        new_password: newPassword,
      });
      toast.success(res?.message || '密码修改成功');
      setPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || '修改失败');
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-semibold mb-6">全局设置</h2>

      {/* 用户卡片 */}
      <div className="bg-gradient-to-br from-card to-card/50 border border-border rounded-2xl p-6 flex items-center gap-6 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-primary/20 transition-colors duration-700"></div>
        
        <div className="relative w-20 h-20 rounded-full p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-primary/20">
          <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-indigo-200 to-pink-200">
            {user?.username?.substring(0, 1).toUpperCase() || 'S'}
          </div>
        </div>
        
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold">{user?.username || 'SyncHub 用户'}</h3>
            <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold rounded uppercase tracking-wider">Pro</span>
          </div>
          <p className="text-muted-foreground text-sm mt-1">{user?.email || 'synchub@example.com'}</p>
          <div className="mt-4 flex gap-3">
            <button 
              onClick={() => setProfileDialogOpen(true)}
              className="px-4 py-1.5 text-xs font-medium bg-secondary text-foreground rounded-lg border border-border hover:bg-secondary/80 active:scale-95 transition-all duration-200"
            >
              编辑资料
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg border border-transparent hover:border-destructive/20 active:scale-95 transition-all duration-200"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>

      {/* 偏好设置 */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">偏好设置</h3>
        
        <SettingItem 
          icon={<Palette size={18} />} 
          title="外观主题" 
          desc={theme === 'dark' ? '已启用深色主题' : '已启用浅色主题'}
          toggle 
          active={theme === 'dark'}
          onToggle={() => {
            setTheme(theme === 'dark' ? 'light' : 'dark');
            toast.success(theme === 'dark' ? '已切换到浅色主题' : '已切换到深色主题');
          }}
          colorClass="text-purple-400 bg-purple-500/10"
        />
        <SettingItem 
          icon={<Bell size={18} />} 
          title="通知推送" 
          desc={settings.notifications ? '已开启消息通知' : '已关闭消息通知'}
          toggle 
          active={settings.notifications}
          onToggle={toggleNotifications}
          colorClass="text-amber-400 bg-amber-500/10"
        />
        <SettingItem 
          icon={<Shield size={18} />} 
          title="隐私安全" 
          desc="修改账户登录密码" 
          toggle={false}
          action="修改密码"
          onAction={() => setPasswordDialogOpen(true)}
          colorClass="text-emerald-400 bg-emerald-500/10"
        />
        <SettingItem 
          icon={<Globe size={18} />} 
          title="网络同步" 
          desc={settings.wifiOnly ? '仅在 Wi-Fi 下同步大文件' : '使用任意网络同步'}
          toggle 
          active={settings.wifiOnly}
          onToggle={toggleWifiOnly}
          colorClass="text-blue-400 bg-blue-500/10"
        />
      </div>

      {/* 存储条 */}
      <div className="pt-6 border-t border-border/60">
        <div className="flex justify-between text-sm mb-3">
          <span className="font-medium">存储空间占用</span>
          <span className="text-muted-foreground font-mono">4.2 GB / 10 GB</span>
        </div>
        <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden border border-border/50">
          <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 w-[42%] shadow-[0_0_15px_rgba(168,85,247,0.4)]"></div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">剩余 5.8 GB 可用空间</p>
      </div>

      {/* 退出登录 */}
      <div className="pt-6 border-t border-border/60">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-xl border border-destructive/20 active:scale-[0.98] transition-all duration-200"
        >
          <LogOut size={16} />
          退出登录
        </button>
      </div>

      {/* 编辑资料对话框 */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User size={18} />编辑个人资料</DialogTitle>
            <DialogDescription>修改您的用户名和邮箱地址</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} placeholder="请输入用户名" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">邮箱地址</Label>
              <Input id="email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="请输入邮箱" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveProfile}>保存更改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 修改密码对话框 */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock size={18} />修改密码</DialogTitle>
            <DialogDescription>请输入当前密码和新密码</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="current-password">当前密码</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="请输入当前密码" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="请输入新密码（至少6位）" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="请再次输入新密码" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>取消</Button>
            <Button onClick={handleChangePassword}>确认修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 通知权限被拒绝对话框 */}
      <Dialog open={permissionDeniedDialogOpen} onOpenChange={setPermissionDeniedDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-500"><AlertCircle size={18} />需要通知权限</DialogTitle>
            <DialogDescription>您之前拒绝了通知权限，需要在浏览器设置中手动开启</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-secondary/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">如何开启通知权限：</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>点击浏览器地址栏左侧的锁图标 </li>
                <li>找到「通知」或「Notifications」选项</li>
                <li>将其设置为「允许」</li>
                <li>刷新页面后重试</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPermissionDeniedDialogOpen(false)}>我知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingItem({ icon, title, desc, toggle, action, active, onToggle, onAction, colorClass = "text-muted-foreground bg-secondary/50" }: { 
  icon: React.ReactNode;
  title: string;
  desc: string;
  toggle?: boolean;
  action?: string;
  active?: boolean;
  onToggle?: () => void;
  onAction?: () => void;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-card/30 border border-border/50 rounded-xl hover:bg-card/60 hover:border-border transition-all duration-200 group">
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-lg ${colorClass} transition-transform group-hover:scale-110 duration-300`}>{icon}</div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div>
        {toggle ? (
          <button
            onClick={onToggle}
            className={`w-12 h-7 rounded-full relative cursor-pointer transition-all duration-300 ease-in-out active:scale-95 ${active ? 'bg-primary shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-secondary'}`}
          >
            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ease-in-out ${active ? 'left-6' : 'left-1'}`}></div>
          </button>
        ) : action ? (
          <button onClick={onAction} className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 bg-secondary rounded-lg border border-border hover:border-border/80 active:scale-95 transition-all duration-200">
            {action}
          </button>
        ) : null}
      </div>
    </div>
  );
}
