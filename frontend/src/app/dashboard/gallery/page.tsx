'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { filesApi } from '@/lib/api';
import { API_BASE_URL } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { 
  Plus, 
  Copy, 
  Link as LinkIcon,
  Check,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface FileItem {
  id: string;
  filename: string;
  size: number;
  mime_type: string;
  is_public: boolean;
  share_token: string | null;
  created_at: string;
  download_url: string;
  public_url: string | null;
}

type UploadStatus = 'pending' | 'uploading' | 'success' | 'error';
type UploadTask = {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  error?: string;
};

export default function GalleryPage() {
  const [images, setImages] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  const getShareUrl = (publicUrl: string) => {
    return publicUrl.startsWith('http') ? publicUrl : `${API_BASE_URL}${publicUrl}`;
  };

  const fetchImages = async () => {
    setLoading(true);
    try {
      const data = await filesApi.list(0, 50, 'gallery');
      setImages(data.filter((f: FileItem) => f.mime_type?.startsWith('image/')));
    } catch {
      toast.error('加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const uploadSingle = async (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    if (!task) return;

    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading' as UploadStatus, progress: 0, error: undefined } : t));
    try {
      await filesApi.upload(task.file, true, 'Web', wsClient.getClientId(), false, 'gallery', {
        onProgress: (p) => {
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: p } : t));
        }
      });
      setUploadTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, status: 'success' as UploadStatus, progress: 100 } : t);
        return next.length > 0 && next.every(x => x.status === 'success') ? [] : next;
      });
      fetchImages();
    } catch (e: any) {
      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' as UploadStatus, error: e?.message || '上传失败' } : t));
    }
  };

  useEffect(() => {
    const unsubscribeMaybe = wsClient.onMessage((raw) => {
      const data = raw as { type?: string; action?: string; source?: string };
      if (data.type !== 'files_event') return;
      if (data.source && data.source !== 'gallery') return;
      if (data.action === 'uploaded' || data.action === 'deleted' || data.action === 'updated') {
        fetchImages();
      }
    });
    return () => {
      if (typeof unsubscribeMaybe === 'function') {
        unsubscribeMaybe();
      }
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const imagesToUpload = selected.filter((f) => f.type.startsWith('image/'));
    const skipped = selected.length - imagesToUpload.length;
    if (imagesToUpload.length === 0) {
      toast.error('请选择图片文件');
      e.target.value = '';
      return;
    }
    if (skipped > 0) {
      toast.message(`已忽略 ${skipped} 个非图片文件`);
    }

    const tasks: UploadTask[] = imagesToUpload.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      progress: 0,
      status: 'pending' as UploadStatus,
    }));

    setUploadTasks(tasks);
    setUploading(true);
    try {
      for (const t of tasks) {
        // eslint-disable-next-line no-await-in-loop
        await (async () => {
          setUploadTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'uploading' as UploadStatus } : x));
          await filesApi.upload(t.file, true, 'Web', wsClient.getClientId(), false, 'gallery', {
            onProgress: (p) => {
              setUploadTasks(prev => prev.map(x => x.id === t.id ? { ...x, progress: p } : x));
            }
          });
          setUploadTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'success' as UploadStatus, progress: 100 } : x));
        })();
      }

      toast.success('图片上传完成');
      fetchImages();
      setTimeout(() => {
        setUploadTasks(prev => (prev.length > 0 && prev.every(x => x.status === 'success')) ? [] : prev);
      }, 800);
    } catch {
      toast.error('部分图片上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const copyMarkdown = async (file: FileItem) => {
    if (!file.public_url) {
      try {
        const updated = await filesApi.update(file.id, { is_public: true });
        setImages(images.map(f => f.id === file.id ? updated : f));
        const fullUrl = getShareUrl(updated.public_url);
        const markdown = `![${file.filename}](${fullUrl})`;
        await navigator.clipboard.writeText(markdown);
        setCopiedId(`md-${file.id}`);
        toast.success('Markdown 已复制');
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error('操作失败');
      }
      return;
    }
    const fullUrl = getShareUrl(file.public_url);
    const markdown = `![${file.filename}](${fullUrl})`;
    await navigator.clipboard.writeText(markdown);
    setCopiedId(`md-${file.id}`);
    toast.success('Markdown 已复制');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyLink = async (file: FileItem) => {
    if (!file.public_url) {
      try {
        const updated = await filesApi.update(file.id, { is_public: true });
        setImages(images.map(f => f.id === file.id ? updated : f));
        const fullUrl = getShareUrl(updated.public_url);
        await navigator.clipboard.writeText(fullUrl);
        setCopiedId(`link-${file.id}`);
        toast.success('链接已复制');
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        toast.error('操作失败');
      }
      return;
    }
    const fullUrl = getShareUrl(file.public_url);
    await navigator.clipboard.writeText(fullUrl);
    setCopiedId(`link-${file.id}`);
    toast.success('链接已复制');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`确定删除图片 ${file.filename}?`)) return;
    try {
      await filesApi.delete(file.id);
      setImages(images.filter(f => f.id !== file.id));
      toast.success('图片已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold">图床画廊</h2>
          <p className="text-muted-foreground text-sm mt-1">管理公开图片，一键生成 Markdown 链接</p>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={fetchImages}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>

          <input
            type="file"
            accept="image/*"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            onChange={handleUpload}
            disabled={uploading}
          />
          <Button 
            disabled={uploading}
            className="bg-gradient-to-r from-pink-600 to-rose-600 text-white hover:from-pink-500 hover:to-rose-500 shadow-[0_4px_20px_-4px_rgba(244,63,94,0.5)]"
          >
            <Plus size={18} className="mr-2" />
            {uploading ? '上传中...' : '上传图片'}
          </Button>
        </div>
      </div>

      {uploadTasks.length > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">上传队列</div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">{uploadTasks.filter(t => t.status === 'success').length}/{uploadTasks.length}</div>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setUploadTasks([])}>
                关闭
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            {uploadTasks.map((t) => (
              <div key={t.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.file.name}</div>
                    <div className="text-xs text-muted-foreground">{t.status === 'error' ? (t.error || '上传失败') : t.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.status === 'error' && (
                      <Button size="sm" variant="outline" className="h-8" onClick={() => uploadSingle(t.id)}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        重试
                      </Button>
                    )}
                    <div className="text-xs font-mono w-10 text-right">{t.progress}%</div>
                  </div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={t.status === 'error' ? 'h-full bg-red-500 transition-all' : t.status === 'success' ? 'h-full bg-green-500 transition-all' : 'h-full bg-primary transition-all'}
                    style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ScrollArea className="h-[calc(100vh-200px)]">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
            <div className="h-16 w-16 bg-secondary/50 rounded-2xl flex items-center justify-center">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">暂无图片</h3>
            <p className="text-sm text-muted-foreground">上传图片开始使用图床功能</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {images.map((img) => (
              <div 
                key={img.id} 
                className="group relative bg-card border border-border rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-pink-500/30 transition-all duration-300 hover:-translate-y-1"
              >
                {/* 图片区域 */}
                <div className="aspect-square bg-secondary relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={img.public_url ? getShareUrl(img.public_url) : img.download_url} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" 
                    alt={img.filename} 
                  />
                   
                  {/* 悬停遮罩 */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                    <button 
                      onClick={() => copyMarkdown(img)}
                      className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition transform hover:scale-105"
                    >
                      {copiedId === `md-${img.id}` ? <Check size={14}/> : <Copy size={14}/>}
                      复制 MD
                    </button>
                    <button 
                      onClick={() => copyLink(img)}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 text-white text-xs font-bold rounded-full border border-zinc-600 hover:bg-zinc-700 transition transform hover:scale-105"
                    >
                      {copiedId === `link-${img.id}` ? <Check size={14}/> : <LinkIcon size={14}/>}
                      复制链接
                    </button>
                    <button 
                      onClick={() => handleDelete(img)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-full hover:bg-red-700 transition transform hover:scale-105"
                    >
                      <Trash2 size={14}/>
                      删除
                    </button>
                  </div>
                </div>
                {/* 底部信息 */}
                <div className="p-3 bg-card flex justify-between items-center border-t border-border group-hover:bg-secondary/50 transition-colors">
                  <span className="text-xs text-muted-foreground truncate max-w-[120px] font-medium">{img.filename}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${img.is_public ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' : 'bg-zinc-500'}`}></span>
                    <span className="text-[10px] text-muted-foreground uppercase">{img.is_public ? '公开' : '私密'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
