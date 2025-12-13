import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 计算项目根目录 (backend 目录)
// src/config/env.js -> src/config -> src -> backend
const rootDir = path.resolve(__dirname, '../../');

// 优先加载开发环境配置
if (process.env.NODE_ENV === 'development') {
    dotenv.config({ path: path.join(rootDir, '.env.development') });
} else {
    dotenv.config({ path: path.join(rootDir, '.env') });
}

// 导出环境变量以便调试（可选）
export default process.env;