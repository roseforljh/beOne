import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../utils/api';

async function saveBlobWithPicker(blob, filename) {
  const picker = window?.showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const ext = (filename || '').includes('.') ? filename.split('.').pop() : '';
      const handle = await picker({
        suggestedName: filename || 'download',
        types: ext
          ? [
              {
                description: 'File',
                accept: { 'application/octet-stream': [`.${ext}`] },
              },
            ]
          : undefined,
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.error('showSaveFilePicker failed, fallback to default download:', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function FilePreview({ file, onClose }) {
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  if (!file) return null;

  const isImage = file.mimetype?.startsWith('image/');
  const isVideo = file.mimetype?.startsWith('video/');
  const isAudio = file.mimetype?.startsWith('audio/');
  const isPDF = file.mimetype?.includes('pdf');
  const isText = file.mimetype?.startsWith('text/') || file.mimetype?.includes('json') || file.mimetype?.includes('xml');

  // 加载文本内容
  useEffect(() => {
    if (isText && file.id) {
      setLoadingText(true);
      
      const previewUrl = api.getPreviewUrl(file.id);
      console.log('预览 URL:', previewUrl);
      
      // 使用 fetch 加载文本（URL 中已包含 token）
      fetch(previewUrl)
        .then(response => {
          console.log('响应状态:', response.status);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.text();
        })
        .then(text => {
          console.log('文本内容长度:', text.length);
          setTextContent(text);
        })
        .catch(error => {
          console.error('加载文本失败:', error);
          setTextContent(`加载文本内容失败: ${error.message}`);
        })
        .finally(() => {
          setLoadingText(false);
        });
    }
  }, [file.id, isText]);

  const handleDownload = async () => {
    const url = api.getDownloadUrl(file.id);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    await saveBlobWithPicker(blob, file.original_name);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-2 md:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-taiji-white rounded-xl md:rounded-2xl max-w-6xl w-full h-[95vh] md:h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="bg-taiji-black text-taiji-white px-3 md:px-6 py-3 md:py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex-1 min-w-0 mr-2 md:mr-4">
              <h3 className="text-sm md:text-base font-medium truncate">{file.original_name}</h3>
              <p className="text-xs opacity-75">{file.mimetype}</p>
            </div>
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={handleDownload}
                className="px-3 md:px-4 py-2 bg-taiji-white text-taiji-black rounded-lg hover:bg-taiji-gray-100 transition-colors text-xs md:text-sm font-medium"
              >
                下载
              </button>
              <button
                onClick={onClose}
                className="px-3 md:px-4 py-2 bg-taiji-gray-700 text-taiji-white rounded-lg hover:bg-taiji-gray-600 transition-colors text-xs md:text-sm font-medium"
              >
                关闭
              </button>
            </div>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 overflow-auto bg-taiji-gray-100 flex items-center justify-center p-2 md:p-4">
            {isImage && (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={api.getPreviewUrl(file.id)}
                  alt={file.original_name}
                  className="max-w-full max-h-full object-contain"
                  style={{ maxHeight: 'calc(95vh - 120px)' }}
                  onError={(e) => {
                    console.error('图片加载失败:', api.getPreviewUrl(file.id));
                    e.target.onerror = null;
                    e.target.parentElement.innerHTML = `
                      <div class="text-center">
                        <p class="text-6xl mb-4">🖼️</p>
                        <p class="text-taiji-gray-600 mb-4">图片加载失败</p>
                        <p class="text-sm text-taiji-gray-500">文件ID: ${file.id}</p>
                      </div>
                    `;
                  }}
                />
              </div>
            )}

            {isVideo && (
              <div className="w-full h-full flex items-center justify-center">
                <video
                  controls
                  className="max-w-full max-h-full"
                  style={{ maxHeight: 'calc(95vh - 120px)' }}
                  src={api.getPreviewUrl(file.id)}
                >
                  您的浏览器不支持视频播放
                </video>
              </div>
            )}

            {isAudio && (
              <div className="w-full max-w-md px-4">
                <div className="bg-taiji-white rounded-lg p-4 md:p-6 shadow-lg">
                  <div className="text-center mb-4">
                    <p className="text-5xl md:text-6xl mb-4">🎵</p>
                    <p className="text-base md:text-lg font-medium text-taiji-black break-words">
                      {file.original_name}
                    </p>
                  </div>
                  <audio controls className="w-full" src={api.getPreviewUrl(file.id)}>
                    您的浏览器不支持音频播放
                  </audio>
                </div>
              </div>
            )}

            {isPDF && (
              <div className="w-full h-full">
                <embed
                  src={api.getPreviewUrl(file.id)}
                  type="application/pdf"
                  className="w-full h-full"
                  style={{ minHeight: '500px', maxHeight: 'calc(95vh - 120px)' }}
                />
              </div>
            )}

            {isText && (
              <div className="w-full h-full flex items-center justify-center px-2 md:px-4">
                <div className="w-full max-w-4xl bg-taiji-white rounded-lg p-3 md:p-6 shadow-lg max-h-full overflow-auto">
                  {loadingText ? (
                    <p className="text-center text-taiji-gray-500">加载中...</p>
                  ) : (
                    <pre className="text-xs md:text-sm text-taiji-black whitespace-pre-wrap break-words font-mono">
                      {textContent}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {!isImage && !isVideo && !isAudio && !isPDF && !isText && (
              <div className="text-center">
                <p className="text-6xl mb-4">📄</p>
                <p className="text-taiji-gray-600 mb-4">无法预览此文件类型</p>
                <button
                  onClick={handleDownload}
                  className="btn-primary"
                >
                  下载文件
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

