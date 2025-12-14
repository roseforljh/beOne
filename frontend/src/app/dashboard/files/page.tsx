'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { filesApi, API_BASE_URL } from '@/lib/api';
import { wsClient } from '@/lib/websocket';
import { 
  Upload, 
  File as FileIcon, 
  Image as ImageIcon, 
  MoreHorizontal, 
  Link as LinkIcon, 
  Trash2, 
  Download,
  Search,
  Eye,
  Globe,
  Lock,
  Grid,
  List as ListIcon,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

export default function CloudDrivePage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploading, setUploading] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [privateThumbUrls, setPrivateThumbUrls] = useState<Record<string, string>>({});
  const privateThumbUrlsRef = useRef<Record<string, string>>({});

  const downloadFile = async (file: FileItem) => {
    try {
      const { blob, filename } = await filesApi.download(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('下载失败');
    }
  };

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const data = await filesApi.list(0, 50, 'drive');
      setFiles(data);
    } catch {
      toast.error('加载文件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      Object.values(privateThumbUrlsRef.current).forEach((u) => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      privateThumbUrlsRef.current = {};
    };
  }, []);

  useEffect(() => {
    fetchFiles();
  }, []);

  useEffect(() => {
    const unsubscribeMaybe = wsClient.onMessage((raw) => {
      const data = raw as { type?: string; action?: string; source?: string };
      if (data.type !== 'files_event') return;
      if (data.source && data.source !== 'drive') return;
      if (data.action === 'uploaded' || data.action === 'deleted' || data.action === 'updated') {
        fetchFiles();
      }
    });
    return () => {
      if (typeof unsubscribeMaybe === 'function') {
        unsubscribeMaybe();
      }
    };
  }, []);

  const uploadSingle = async (taskId: string) => {
    const task = uploadTasks.find(t => t.id === taskId);
    if (!task) return;

    setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'uploading' as UploadStatus, progress: 0, error: undefined } : t));
    try {
      await filesApi.upload(task.file, false, 'Web', wsClient.getClientId(), false, 'drive', {
        onProgress: (p) => {
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, progress: p } : t));
        }
      });
      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'success' as UploadStatus, progress: 100 } : t));
      // 若全部成功，自动清空队列
      setUploadTasks(prev => {
        const next = prev.map(t => t.id === taskId ? { ...t, status: 'success' as UploadStatus, progress: 100 } : t);
        return next.length > 0 && next.every(x => x.status === 'success') ? [] : next;
      });
    } catch (e: any) {
      setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'error' as UploadStatus, error: e?.message || '上传失败' } : t));
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const tasks: UploadTask[] = selected.map((file) => ({
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
          await filesApi.upload(t.file, false, 'Web', wsClient.getClientId(), false, 'drive', {
            onProgress: (p) => {
              setUploadTasks(prev => prev.map(x => x.id === t.id ? { ...x, progress: p } : x));
            }
          });
          setUploadTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: 'success' as UploadStatus, progress: 100 } : x));
        })();
      }

      toast.success('文件上传完成');
      fetchFiles();
      // 若全部成功，自动清空队列（保留短暂显示）
      setTimeout(() => {
        setUploadTasks(prev => (prev.length > 0 && prev.every(x => x.status === 'success')) ? [] : prev);
      }, 800);
    } catch {
      toast.error('部分文件上传失败');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const ensurePrivateThumb = async (file: FileItem) => {
    if (!file.mime_type?.startsWith('image/')) return;
    if (file.is_public) return;
    if (privateThumbUrlsRef.current[file.id]) return;
    try {
      const { blob } = await filesApi.download(file.id);
      const url = URL.createObjectURL(blob);
      const prevUrl = privateThumbUrlsRef.current[file.id];
      if (prevUrl) {
        try { URL.revokeObjectURL(prevUrl); } catch {}
      }
      privateThumbUrlsRef.current = { ...privateThumbUrlsRef.current, [file.id]: url };
      setPrivateThumbUrls((prev) => ({ ...prev, [file.id]: url }));
    } catch {
      // ignore thumb failure
    }
  };

  useEffect(() => {
    // Prefetch private image thumbnails so they show immediately without hover.
    // Limit concurrency to avoid blocking the UI/network.
    if (loading) return;

    const candidates = files.filter((f) => f.mime_type?.startsWith('image/') && !f.is_public);
    if (candidates.length === 0) return;

    let cancelled = false;
    const concurrency = 3;
    let index = 0;

    const worker = async () => {
      while (!cancelled) {
        const file = candidates[index++];
        if (!file) return;
        await ensurePrivateThumb(file);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker());
    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [loading, files]);

  const handleDelete = async (file: FileItem) => {
    if (!confirm(`确定删除 ${file.filename}?`)) return;

    try {
      await filesApi.delete(file.id);
      setFiles(files.filter(f => f.id !== file.id));

      const thumbUrl = privateThumbUrlsRef.current[file.id];
      if (thumbUrl) {
        try { URL.revokeObjectURL(thumbUrl); } catch {}
        const next = { ...privateThumbUrlsRef.current };
        delete next[file.id];
        privateThumbUrlsRef.current = next;
        setPrivateThumbUrls((prev) => {
          const p = { ...prev };
          delete p[file.id];
          return p;
        });
      }

      toast.success('文件已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleTogglePublic = async (file: FileItem) => {
    try {
      const updated = await filesApi.update(file.id, { is_public: !file.is_public });
      setFiles(files.map(f => f.id === file.id ? updated : f));
      toast.success(updated.is_public ? '文件已设为公开' : '文件已设为私密');
    } catch {
      toast.error('更新失败');
    }
  };

  const copyLink = async (file: FileItem) => {
    if (!file.public_url) {
      toast.error('文件必须设为公开才能分享');
      return;
    }
    const fullUrl = file.public_url.startsWith('http') ? file.public_url : `${window.location.origin}${file.public_url}`;
    await navigator.clipboard.writeText(fullUrl);
    toast.success('链接已复制到剪贴板');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFiles = files.filter(f => 
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isImage = (mimeType: string) => mimeType?.startsWith('image/');
  const getThumbSrc = (file: FileItem) => {
    if (!isImage(file.mime_type)) return null;
    // 使用缩略图接口优化网络性能
    if (file.is_public && file.public_url) {
      const base = file.public_url.startsWith('http') ? file.public_url : `${API_BASE_URL}${file.public_url}`;
      return `${base}/thumb?size=300`;
    }
    // 私有图片使用 API 缩略图接口
    return `${API_BASE_URL}/api/v1/files/${file.id}/thumb?size=300`;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-background/95 backdrop-blur py-2">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-transparent focus:bg-background focus:border-input transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={fetchFiles}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>

          <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-transparent">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7 rounded-md", viewMode === 'grid' && "bg-background shadow-sm text-foreground")}
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7 rounded-md", viewMode === 'list' && "bg-background shadow-sm text-foreground")}
              onClick={() => setViewMode('list')}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="relative">
            <input
              type="file"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button disabled={uploading} size="sm" className="h-9">
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? '上传中...' : '上传文件'}
            </Button>
          </div>
        </div>
      </div>

      {uploadTasks.length > 0 && (
        <Card className="p-4">
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
                    className={cn(
                      'h-full transition-all',
                      t.status === 'error' ? 'bg-red-500' : t.status === 'success' ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, t.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Files Grid/List */}
      <ScrollArea className="flex-1 -mx-6 px-6">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
            <div className="h-12 w-12 bg-muted/50 rounded-full flex items-center justify-center">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">暂无文件</h3>
            <p className="text-sm text-muted-foreground">上传文件开始使用</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-8">
            {filteredFiles.map((file) => (
              <Card 
                key={file.id} 
                className="group relative overflow-hidden border bg-card hover:shadow-md transition-all duration-200"
              >
                {/* Preview Area */}
                <div 
                  className="aspect-[4/3] bg-muted/30 flex items-center justify-center relative cursor-pointer overflow-hidden"
                  onClick={() => isImage(file.mime_type) && setPreviewFile(file)}
                >
                  {isImage(file.mime_type) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={getThumbSrc(file) || file.download_url} 
                      alt={file.filename}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <FileIcon className="h-12 w-12 text-muted-foreground/50" />
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {file.is_public && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 px-3 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(file);
                        }}
                      >
                        <LinkIcon className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    )}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(file.size)}
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => downloadFile(file)}>
                          <Download className="mr-2 h-4 w-4" /> 下载
                        </DropdownMenuItem>
                        {isImage(file.mime_type) && (
                          <DropdownMenuItem onClick={() => setPreviewFile(file)}>
                            <Eye className="mr-2 h-4 w-4" /> 预览
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleTogglePublic(file)}>
                          {file.is_public ? (
                            <>
                              <Lock className="mr-2 h-4 w-4" /> 设为私密
                            </>
                          ) : (
                            <>
                              <Globe className="mr-2 h-4 w-4" /> 设为公开
                            </>
                          )}
                        </DropdownMenuItem>
                        {file.is_public && (
                          <DropdownMenuItem onClick={() => copyLink(file)}>
                            <LinkIcon className="mr-2 h-4 w-4" /> 复制链接
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(file)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> 删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-1 pb-8">
            {filteredFiles.map((file) => (
              <div 
                key={file.id}
                className="group flex items-center justify-between p-2 rounded-lg border border-transparent hover:border-border hover:bg-muted/50 transition-all"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-8 w-8 bg-muted rounded flex items-center justify-center shrink-0">
                    {isImage(file.mime_type) ? (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 grid grid-cols-12 gap-4">
                    <div className="col-span-6 flex items-center">
                      <p className="text-sm font-medium truncate">{file.filename}</p>
                    </div>
                    <div className="col-span-3 flex items-center">
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{new Date(file.created_at).toLocaleDateString()}</p>
                      {file.is_public && (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.is_public && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(file)}>
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFile(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleTogglePublic(file)}>
                        {file.is_public ? 'Make Private' : 'Make Public'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(file)} className="text-destructive">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none sm:rounded-none md:rounded-lg">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            {previewFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewFile.download_url}
                alt={previewFile.filename}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                className="shadow-lg backdrop-blur bg-background/80 hover:bg-background/90"
                onClick={() => previewFile && downloadFile(previewFile)}
              >
                <Download className="h-4 w-4 mr-2" /> Download Original
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
