'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Cloud, Github } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('dev_user');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const provider = params.get('provider');

    if (!token) return;

    localStorage.setItem('token', token);
    authApi
      .getMe()
      .then((user) => {
        setAuth(token, user);
        toast.success(`Signed in${provider ? ` via ${provider}` : ''}`);
        router.push('/dashboard');
      })
      .catch((error) => {
        console.error(error);
        localStorage.removeItem('token');
        toast.error('OAuth login failed');
      });
  }, [router, setAuth]);

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const data = await authApi.devLogin(username);
      setAuth(data.access_token, data.user);
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Login failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'github' | 'google') => {
    window.location.href = authApi.oauthLoginUrl(provider);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[350px] space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center">
            <Cloud className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            SyncHub
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your username to sign in to your account
          </p>
        </div>

        <div className="grid gap-6">
          <form onSubmit={(e) => { e.preventDefault(); handleDevLogin(); }}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="dev_user"
                  autoCapitalize="none"
                  autoCorrect="off"
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <Button disabled={loading} className="w-full">
                {loading ? 'Signing in...' : 'Sign In with Dev Account'}
              </Button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={() => handleOAuthLogin('github')} disabled={loading}>
              <Github className="mr-2 h-4 w-4" />
              Github
            </Button>
            <Button variant="outline" onClick={() => handleOAuthLogin('google')} disabled={loading}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="currentColor"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="currentColor"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="currentColor"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="currentColor"
                />
              </svg>
              Google
            </Button>
          </div>
        </div>
        
        <p className="px-8 text-center text-sm text-muted-foreground">
          By clicking continue, you agree to our{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
