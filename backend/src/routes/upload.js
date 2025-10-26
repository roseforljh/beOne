import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.js';
import { initUpload, uploadChunk, completeUpload } from '../controllers/uploadController.js';

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

// 所有上传路由需要认证
router.use(authenticateToken);

// 初始化上传
router.post('/init', initUpload);

// 上传分片
router.post('/chunk', upload.single('chunk'), uploadChunk);

// 完成上传
router.post('/complete', completeUpload);

export default router;

