import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const numCPUs = os.cpus().length;
const WORKERS = process.env.WORKERS || Math.max(2, numCPUs - 1); // 保留一个核心给系统

if (cluster.isPrimary) {
  console.log(`
🚀 主进程 ${process.pid} 正在启动...`);
  console.log(`💻 检测到 ${numCPUs} 个 CPU 核心`);
  console.log(`👷 启动 ${WORKERS} 个工作进程
`);

  // 创建工作进程
  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork();
    console.log(`✅ 工作进程 ${worker.process.pid} 已启动`);
  }

  // 监听工作进程退出
  cluster.on('exit', (worker, code, signal) => {
    console.log(`❌ 工作进程 ${worker.process.pid} 已退出 (code: ${code}, signal: ${signal})`);
    
    // 自动重启崩溃的工作进程
    if (code !== 0 && !worker.exitedAfterDisconnect) {
      console.log('🔄 正在重启工作进程...');
      const newWorker = cluster.fork();
      console.log(`✅ 新工作进程 ${newWorker.process.pid} 已启动`);
    }
  });

  // 监听工作进程在线
  cluster.on('online', (worker) => {
    console.log(`🟢 工作进程 ${worker.process.pid} 已在线`);
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('\n⚠️  收到 SIGTERM 信号，正在优雅关闭...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

  process.on('SIGINT', () => {
    console.log('\n⚠️  收到 SIGINT 信号，正在优雅关闭...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
    process.exit(0);
  });

} else {
  // 工作进程运行实际的应用
  import('./index.js');
}