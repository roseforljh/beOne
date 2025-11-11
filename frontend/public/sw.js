// Service Worker for caching static assets
const CACHE_NAME = 'beone-cache-v1';
const RUNTIME_CACHE = 'beone-runtime-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/beone-logo.svg',
  '/taiji.svg',
  '/logo.jpg'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch 事件 - 缓存策略
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 HTTP(S) 请求
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API 请求 - 网络优先,失败时使用缓存
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 只缓存 GET 请求的成功响应
          if (request.method === 'GET' && response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone).catch((err) => {
                console.warn('[SW] Cache put failed:', err);
              });
            });
          }
          return response;
        })
        .catch((err) => {
          console.warn('[SW] API request failed:', err);
          return caches.match(request).then((cachedResponse) => {
            // 如果有缓存的响应，返回一个有效的Response对象
            if (cachedResponse) {
              return cachedResponse;
            }
            // 如果没有缓存，返回一个简单的错误响应
            return new Response(
              JSON.stringify({ error: '网络请求失败，且无可用缓存' }),
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }

  // 静态资源 - 缓存优先,失败时使用网络
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // 后台更新缓存
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response).catch((err) => {
                  console.warn('[SW] Background cache update failed:', err);
                });
              });
            }
          }).catch((err) => {
            console.warn('[SW] Background fetch failed:', err);
          });
          return cachedResponse;
        }
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch((err) => {
                console.warn('[SW] Cache put failed:', err);
              });
            });
          }
          return response;
        }).catch((err) => {
          console.warn('[SW] Static resource fetch failed:', err);
          // 返回一个基本的错误响应
          return new Response('资源加载失败', { status: 404 });
        });
      })
    );
    return;
  }

  // HTML 页面 - 网络优先
  event.respondWith(
    fetch(request).catch((err) => {
      console.warn('[SW] HTML page fetch failed:', err);
      return caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // 如果没有缓存的HTML，返回一个基本页面
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>离线模式</title></head>
          <body>
            <h1>网络连接失败</h1>
            <p>请检查网络连接后重试</p>
          </body>
          </html>
        `, {
          status: 503,
          headers: { 'Content-Type': 'text/html' }
        });
      });
    })
  );
});