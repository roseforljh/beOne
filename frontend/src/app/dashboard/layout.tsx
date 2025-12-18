'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { wsClient } from '@/lib/websocket';
import { Button } from '@/components/ui/button';
import { Cloud, MessageSquare, HardDrive, Image as ImageIcon, Settings, LogOut, Search, Sun, Moon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, isAuthenticated } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isAuthenticated()) { router.push('/login'); return; }
    if (token) { wsClient.connect(token); }
    return () => { wsClient.disconnect(); };
  }, [token, isAuthenticated, router]);

  const handleLogout = () => { wsClient.disconnect(); logout(); router.push('/login'); };

  const navItems = [
    { href: '/dashboard', icon: MessageSquare, label: '实时对话板', color: 'text-indigo-400', bgColor: 'bg-indigo-500' },
    { href: '/dashboard/files', icon: HardDrive, label: '我的云盘', color: 'text-emerald-400', bgColor: 'bg-emerald-500' },
    { href: '/dashboard/gallery', icon: ImageIcon, label: '图床画廊', color: 'text-pink-400', bgColor: 'bg-pink-500' },
  ];
  const systemItems = [
    { href: '/dashboard/settings', icon: Settings, label: '全局设置', color: 'text-amber-400', bgColor: 'bg-amber-500' },
  ];

  if (!user || !mounted) return null;

  const getPageTitle = () => {
    if (pathname === '/dashboard') return '实时同步';
    if (pathname === '/dashboard/files') return '文件管理';
    if (pathname === '/dashboard/gallery') return '图床相册';
    if (pathname === '/dashboard/settings') return '偏好设置';
    return '仪表盘';
  };

  const isChatPage = pathname === '/dashboard';

  return (
    <div className="h-screen w-full overflow-hidden flex bg-background text-foreground">
      <aside className="w-64 border-r border-border/60 bg-card/20 flex-col hidden md:flex backdrop-blur-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg flex items-center justify-center shadow-lg">
              <Cloud size={18} className="text-white" />
            </div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">SyncHub</span>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden border", isActive ? "bg-secondary text-foreground border-border/60 shadow-sm" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground border-transparent")}>
                  {isActive && <div className={cn("absolute left-0 top-0 bottom-0 w-1", item.bgColor)}></div>}
                  <span className={cn("transition-colors", isActive ? item.color : "text-muted-foreground group-hover:text-foreground")}><item.icon size={18} /></span>
                  {item.label}
                </button>
              </Link>
            );
          })}
          <div className="pt-6 pb-2 px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">系统管理</div>
          {systemItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden border", isActive ? "bg-secondary text-foreground border-border/60 shadow-sm" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground border-transparent")}>
                  {isActive && <div className={cn("absolute left-0 top-0 bottom-0 w-1", item.bgColor)}></div>}
                  <span className={cn("transition-colors", isActive ? item.color : "text-muted-foreground group-hover:text-foreground")}><item.icon size={18} /></span>
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border/60">
          <div onClick={() => setLogoutConfirmOpen(true)} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 cursor-pointer transition-all duration-300 group border border-transparent hover:border-border/50">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 ring-2 ring-background/50 shadow-lg p-[2px]">
              <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">{user.username?.substring(0, 2).toUpperCase()}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-foreground">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <LogOut size={16} className="text-muted-foreground group-hover:text-destructive transition-colors" />
          </div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative bg-background overflow-hidden">
        <header className="h-16 border-b border-border/40 flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">首页</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">{getPageTitle()}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full text-muted-foreground text-sm w-64 border border-border/60">
              <Search size={14} />
              <input type="text" placeholder="搜索文件或记录..." className="bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/60 text-foreground" />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </header>
        <div className={cn("flex-1", isChatPage ? "overflow-hidden" : "overflow-y-auto")}>{children}</div>
        <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
              <AlertDialogDescription>退出后将返回登录页，需要重新登录才能继续使用。</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>退出登录</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

