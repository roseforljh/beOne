import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileTypeSelector({ onSelect, disabled, position = 'bottom' }) {
  const [showMenu, setShowMenu] = useState(false);

  const fileTypes = [
    { icon: '📷', label: '拍照', accept: 'image/*', capture: 'environment' },
    { icon: '🖼️', label: '相册', accept: 'image/*' },
    { icon: '🎬', label: '视频', accept: 'video/*' },
    { icon: '🎵', label: '音频', accept: 'audio/*' },
    { icon: '📄', label: '文档', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt' },
    { icon: '📁', label: '所有文件', accept: '*/*' },
  ];

  const handleSelect = (type) => {
    setShowMenu(false);
    if (onSelect) {
      onSelect(type);
    }
  };

  return (
    <div className="relative inline-block">
      {/* 触发按钮 */}
      <motion.button
        onClick={() => setShowMenu(!showMenu)}
        disabled={disabled}
        whileTap={{ scale: 0.95 }}
        className="p-2 md:px-4 md:py-3 bg-taiji-gray-200 text-taiji-black rounded-lg hover:bg-taiji-gray-300 transition-colors disabled:opacity-50 text-lg md:text-base flex items-center justify-center min-w-[44px]"
        title="选择文件类型"
      >
        📎
      </motion.button>

      {/* 文件类型菜单 */}
      <AnimatePresence>
        {showMenu && (
          <>
            {/* 遮罩层 */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowMenu(false)}
            />

            {/* 菜单 */}
            <motion.div
              initial={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: position === 'bottom' ? 10 : -10, scale: 0.95 }}
              className={`absolute ${position === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'} left-0 bg-taiji-white rounded-xl shadow-2xl border-2 border-taiji-gray-200 overflow-hidden z-[9999] min-w-[180px]`}
            >
              {fileTypes.map((type, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(type)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-taiji-gray-100 transition-colors text-left border-b border-taiji-gray-100 last:border-b-0"
                >
                  <span className="text-2xl">{type.icon}</span>
                  <span className="text-sm font-medium text-taiji-black">{type.label}</span>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

