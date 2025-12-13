'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { wsClient, ConnectionState } from '@/lib/websocket';
import { useConversationStore, WSMessage } from '@/lib/store';
import { filesApi } from '@/lib/api';
import { ArrowUp, Plus, FileText, Download, Copy, Check, Upload, Smartphone, Laptop, Image as ImageIcon, History, Trash2, WifiOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ConversationSidebar } from '@/components/ConversationSidebar';

export default function ChatPage() {
  const { 
    conversations,
    currentConversationId,
    createConversation, 
    addMessageToCurrentConversation,
    addMessageToBackend,
    clearCurrentConversation,
    getCurrentMessages,
    fetchConversations,
    handleConversationEvent,
  } = useConversationStore();

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);
  
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync messages from store
  useEffect(() => {
    setMessages(getCurrentMessages());
  }, [currentConversationId, conversations, getCurrentMessages]);

  // Connection state listener
  useEffect(() => {
    const unsubscribeState = wsClient.onConnectionStateChange(setConnectionState);
    setConnectionState(wsClient.connectionState);
    return () => { unsubscribeState(); };
  }, []);

  // WebSocket message listener
  useEffect(() => {
    const unsubscribe = wsClient.onMessage((rawData: unknown) => {
      const data = rawData as { type?: string; action?: string; conversation_id?: string; content?: string; filename?: string; device_name?: string; from_client?: string; file_id?: string; mime_type?: string; message?: unknown };
      
      // Handle conversations_event from backend
      if (data.type === 'conversations_event') {
        handleConversationEvent({
          action: data.action || '',
          conversation_id: data.conversation_id || '',
          message: data.message as { id: string; conversation_id: string; type: 'text' | 'file'; content?: string; filename?: string; file_id?: string; mime_type?: string; device_name: string; created_at: string } | undefined,
        });
        if (data.action === 'created') toast.success('其他设备已创建新会话');
        if (data.action === 'cleared') toast.success('会话已被其他设备清空');
        if (data.action === 'deleted') toast.success('会话已被其他设备删除');
        return;
      }

      // text/file messages now handled via conversations_event:message_added - skip here to avoid duplicates
    });
    return () => { unsubscribe(); };
  }, [handleConversationEvent]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg: WSMessage = { id: Date.now().toString(), type: 'text', content: input, device_name: 'Web', timestamp: new Date(), isOwn: true };
    addMessageToCurrentConversation(msg);
    // Save to backend (don't await to avoid blocking UI)
    addMessageToBackend(msg);
    // WebSocket broadcast for real-time sync to other devices
    wsClient.sendText(input, 'Web');
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadFile(file);
        return;
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    e.target.value = '';
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const response = await filesApi.upload(file, false, 'Web', wsClient.getClientId());
      addMessageToCurrentConversation({ id: Date.now().toString(), type: 'file', content: file.name, device_name: 'Web', timestamp: new Date(), file_id: response.file.id, filename: response.file.filename, mime_type: response.file.mime_type, isOwn: true });
      toast.success('上传成功');
    } catch { toast.error('上传失败'); }
    finally { setUploading(false); }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('已复制到剪贴板');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isImageMime = (m?: string) => m?.startsWith('image/');
  const getDeviceIcon = (d?: string) => d?.toLowerCase().includes('mac') || d?.toLowerCase().includes('web') ? <Laptop size={12}/> : <Smartphone size={12}/>;

  const handleNewConversation = async () => {
    const newId = await createConversation();
    if (newId) {
      toast.success('已创建新会话');
    }
  };

  const handleClearConversation = async () => {
    await clearCurrentConversation();
    toast.success('会话已清空');
  };

  return (
    <div className="flex flex-col min-h-full pb-32 relative">
      {/* Conversation Sidebar */}
      <ConversationSidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        onConversationChange={() => {}}
      />

      {/* Top Toolbar */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} title="历史会话">
              <History className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">实时聊天</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleNewConversation} title="新建会话">
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClearConversation} title="清空会话">
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Connection Status */}
        {connectionState !== 'connected' && (
          <div className={cn(
            "flex items-center justify-center gap-2 py-2 px-4 text-sm",
            connectionState === 'connecting' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
            connectionState === 'failed' && "bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-500/20",
            connectionState === 'disconnected' && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          )} onClick={connectionState === 'failed' ? () => wsClient.reconnect() : undefined}>
            {connectionState === 'connecting' && <><Loader2 className="h-4 w-4 animate-spin" /><span>正在连接服务器...</span></>}
            {connectionState === 'failed' && <><WifiOff className="h-4 w-4" /><span>连接失败，点击重试</span></>}
            {connectionState === 'disconnected' && <><WifiOff className="h-4 w-4" /><span>已断开连接</span></>}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
              <div className="h-16 w-16 bg-secondary/50 rounded-2xl flex items-center justify-center">
                <ArrowUp className="h-8 w-8 text-muted-foreground"/>
              </div>
              <div>
                <h3 className="text-lg font-semibold">欢迎使用 SyncHub</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">发送消息、图片和文件，在所有设备间即时同步。</p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span className="bg-secondary/80 border border-border text-muted-foreground text-[10px] px-3 py-1 rounded-full uppercase tracking-wider font-medium shadow-sm">今天</span>
              </div>
              {messages.map((msg) => {
                const isMe = msg.isOwn;
                return (
                  <div key={msg.id} className={cn("flex w-full group animate-in fade-in slide-in-from-bottom-2 duration-300", isMe ? "justify-end" : "justify-start")}>
                    <div className={cn("flex flex-col max-w-[85%] md:max-w-[70%]", isMe ? "items-end" : "items-start")}>
                      {!isMe && (
                        <div className="flex items-center gap-1 mb-1.5 ml-1 text-xs text-muted-foreground font-medium">
                          {getDeviceIcon(msg.device_name)}<span>{msg.device_name}</span>
                        </div>
                      )}
                      <div className={cn(
                        "relative px-4 py-3 text-sm overflow-hidden",
                        isMe 
                          ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl rounded-tr-sm font-medium shadow-lg shadow-indigo-900/20 border border-indigo-500/20" 
                          : "bg-card border border-border text-card-foreground rounded-2xl rounded-tl-sm shadow-sm"
                      )}>
                        {msg.type === 'text' && (
                          <p className={cn("leading-relaxed whitespace-pre-wrap", isMe ? "text-indigo-50" : "text-foreground")}>{msg.content}</p>
                        )}
                        {msg.type === 'file' && (
                          <div className="flex items-center gap-3 pr-4">
                            <div className={cn("p-2.5 rounded-lg", isMe ? "bg-white/20 text-white" : "bg-secondary text-primary")}>
                              {isImageMime(msg.mime_type) ? <ImageIcon size={24}/> : <FileText size={24}/>}
                            </div>
                            <div className="flex flex-col">
                              <span className={cn("font-medium truncate max-w-[150px]", isMe ? "text-white" : "text-foreground")}>{msg.filename}</span>
                              <span className={cn("text-xs", isMe ? "text-indigo-200" : "text-muted-foreground")}>文件</span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 ml-2"><Download className="h-4 w-4"/></Button>
                          </div>
                        )}
                      </div>
                      <div className={cn("flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity", isMe ? "flex-row-reverse" : "flex-row")}>
                        <span className="text-[10px] text-muted-foreground font-mono">{new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.type === 'text' && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(msg.content, msg.id)}>
                            {copiedId === msg.id ? <Check className="h-3 w-3"/> : <Copy className="h-3 w-3"/>}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          <div ref={scrollRef}/>
        </div>
      </ScrollArea>

      <div className="absolute bottom-6 left-0 right-0 px-4 flex justify-center z-30">
        <div className="w-full max-w-3xl bg-card/80 backdrop-blur-2xl border border-border/30 shadow-2xl shadow-black/20 dark:shadow-black/80 rounded-2xl p-2.5 flex items-end gap-2 ring-1 ring-white/5 group focus-within:ring-primary/30 focus-within:border-primary/30 transition-all duration-300">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}/>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-3 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors" disabled={uploading}><Plus size={20}/></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4"/>上传文件</DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><ImageIcon className="mr-2 h-4 w-4"/>上传图片</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <textarea 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="发送消息、粘贴图片或拖拽文件..." 
            className="flex-1 max-h-32 bg-transparent border-none outline-none py-3 px-2 text-sm resize-none placeholder:text-muted-foreground/60 text-foreground font-normal leading-relaxed selection:bg-primary/30" 
            rows={1} 
            disabled={uploading}
          />
          <button 
            onClick={handleSend} 
            disabled={!input.trim() || uploading} 
            className={cn(
              "p-3 rounded-xl transition-all active:scale-95",
              input.trim() 
                ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_0_15px_-3px_rgba(79,70,229,0.5)] hover:shadow-indigo-500/40" 
                : "bg-secondary text-muted-foreground cursor-not-allowed shadow-none"
            )}
          >
            <ArrowUp size={20}/>
          </button>
        </div>
      </div>

      {uploading && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center z-30">
          <span className="bg-card/90 backdrop-blur border border-border shadow-sm text-xs px-3 py-1 rounded-full flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"/>正在上传...
          </span>
        </div>
      )}
    </div>
  );
}
