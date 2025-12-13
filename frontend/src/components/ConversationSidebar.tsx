'use client';

import { useState } from 'react';
import { useConversationStore, Conversation } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Plus, MessageSquare, Trash2, X, ChevronLeft } from 'lucide-react';
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

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationChange: () => void;
}

export function ConversationSidebar({ isOpen, onClose, onConversationChange }: ConversationSidebarProps) {
  const { conversations, currentConversationId, createConversation, selectConversation, deleteConversation } = useConversationStore();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleNewConversation = () => {
    createConversation();
    onConversationChange();
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    onConversationChange();
    onClose();
  };

  const handleDeleteConversation = () => {
    if (deleteId) {
      deleteConversation(deleteId);
      onConversationChange();
      setDeleteId(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  const getPreviewText = (conv: Conversation) => {
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (!lastMsg) return '暂无消息';
    if (lastMsg.type === 'file') return `[文件] ${lastMsg.filename}`;
    return lastMsg.content.slice(0, 30) + (lastMsg.content.length > 30 ? '...' : '');
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 h-full w-80 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold">历史会话</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleNewConversation} title="新建会话">
                <Plus className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} title="关闭">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Conversation List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">暂无会话</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={handleNewConversation}>
                    <Plus className="h-4 w-4 mr-1" />
                    新建会话
                  </Button>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors",
                      conv.id === currentConversationId
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-secondary/50"
                    )}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                      conv.id === currentConversationId ? "bg-primary/20" : "bg-secondary"
                    )}>
                      <MessageSquare className={cn(
                        "h-4 w-4",
                        conv.id === currentConversationId ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm font-medium truncate",
                          conv.id === currentConversationId ? "text-primary" : "text-foreground"
                        )}>
                          {conv.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {getPreviewText(conv)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(conv.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              共 {conversations.length} 个会话
            </p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个会话吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
