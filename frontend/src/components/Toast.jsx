import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

export default function Toast({ 
  isOpen, 
  onClose, 
  message, 
  type = 'success', // 'success', 'error', 'info', 'warning'
  duration = 3000 
}) {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  const typeStyles = {
    success: {
      bg: 'bg-green-500',
      icon: '✓'
    },
    error: {
      bg: 'bg-red-500',
      icon: '✕'
    },
    info: {
      bg: 'bg-blue-500',
      icon: 'ℹ'
    },
    warning: {
      bg: 'bg-yellow-500',
      icon: '⚠'
    }
  };

  const style = typeStyles[type] || typeStyles.info;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[101] max-w-sm w-full mx-4"
        >
          <div className={`${style.bg} text-white rounded-xl shadow-2xl p-4 flex items-center gap-3`}>
            <div className="text-2xl font-bold">
              {style.icon}
            </div>
            <p className="flex-1 text-base font-medium">
              {message}
            </p>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}