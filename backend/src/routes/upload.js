import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { initUpload, uploadChunk, completeUpload, directUpload } from '../controllers/uploadController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置 multer 临时存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/chunks'));
  },
  filename: (req, file, cb) => {
    cb(null, `temp-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 * 1024 // 50GB per chunk
  }
});

// 配置直接上传的 multer（用于小文件）
const directStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/files'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, uniqueFilename);
  }
});

const directUploadMiddleware = multer({
  storage: directStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024 // 10GB
  }
});

// 所有上传路由需要认证
router.use(authenticateToken);

// 直接上传（小文件）
router.post('/direct', directUploadMiddleware.single('file'), directUpload);

// 初始化上传
router.post('/init', initUpload);

// 上传分片
router.post('/chunk', upload.single('chunk'), uploadChunk);

// 完成上传
router.post('/complete', completeUpload);

export default router;

