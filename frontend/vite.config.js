import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // 启用快速刷新
      fastRefresh: true
    }),
    // 打包分析（可选）
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    allowedHosts: [
      'one.everytalk.cc',
      '158.51.78.209',
      'localhost',
      '127.0.0.1'
    ]
  },
  build: {
    // 设置输出目录：移动端模式下输出到 beone-mobile/www
    outDir: mode === 'mobile' ? '../beone-mobile/www' : 'dist',
    emptyOutDir: true,
    // 生产环境优化
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // 生产环境移除 console
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      }
    },
    // 代码分割策略
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库 - 最先加载
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Socket.IO - 延迟加载
          'socket-vendor': ['socket.io-client'],
          // 动画库 - 延迟加载
          'utils-vendor': ['axios', 'framer-motion']
        },
        // 优化 chunk 文件名
        chunkFileNames: 'assets/js/[name]-[hash:8].js',
        entryFileNames: 'assets/js/[name]-[hash:8].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(ext)) {
            return `assets/images/[name]-[hash:8].[ext]`;
          }
          if (/woff2?|ttf|otf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash:8].[ext]`;
          }
          return `assets/[ext]/[name]-[hash:8].[ext]`;
        }
      }
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // chunk 大小警告限制
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    // 小于 4KB 的资源内联为 base64
    assetsInlineLimit: 4096
  },
  // 优化依赖预构建 - 预构建常用依赖加速首次加载
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'socket.io-client',
      '@capacitor/core',
      '@capacitor/status-bar',
      '@capacitor/keyboard'
    ],
    exclude: []
  },
  // 性能优化
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    drop: ['debugger', 'console']  // 移除 debugger 和 console
  }
}))

