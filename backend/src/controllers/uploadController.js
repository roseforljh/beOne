import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads');
const chunksDir = path.join(uploadsDir, 'chunks');
const filesDir = path.join(uploadsDir, 'files');
const thumbsDir = path.join(uploadsDir, 'thumbs');

// 初始化上传
export const initUpload = (req, res) => {
  const { filename, totalChunks, fileSize, mimetype } = req.body;
  
  if (!filename || !totalChunks || !fileSize) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  res.json({ uploadId });
};

// 上传分片
export const uploadChunk = (req, res) => {
  const { uploadId, chunkIndex } = req.body;
  const chunk = req.file;

  if (!uploadId || chunkIndex === undefined || !chunk) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const chunkPath = path.join(chunksDir, `${uploadId}-${chunkIndex}`);

  fs.rename(chunk.path, chunkPath, (err) => {
    if (err) {
      return res.status(500).json({ error: '保存分片失败' });
    }

    // 保存分片信息到数据库
    db.run(
      'INSERT INTO chunks (upload_id, chunk_index, chunk_path) VALUES (?, ?, ?)',
      [uploadId, chunkIndex, chunkPath],
      (err) => {
        if (err) {
          console.error('保存分片记录失败:', err);
        }
      }
    );

    res.json({ success: true, chunkIndex });
  });
};

// 完成上传，合并分片
export const completeUpload = async (req, res) => {
  const { uploadId, filename, totalChunks, mimetype } = req.body;
  const userId = req.user.id;

  if (!uploadId || !filename || !totalChunks) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    // 生成唯一文件名
    const ext = path.extname(filename);
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    const finalPath = path.join(filesDir, uniqueFilename);

    // 创建写入流
    const writeStream = fs.createWriteStream(finalPath);

    // 按顺序合并分片
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunksDir, `${uploadId}-${i}`);
      
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`分片 ${i} 不存在`);
      }

      const chunkBuffer = fs.readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
      
      // 删除分片
      fs.unlinkSync(chunkPath);
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 获取文件大小
    const stats = fs.statSync(finalPath);
    const fileSize = stats.size;

    // 如果是图片，生成缩略图
    if (mimetype && mimetype.startsWith('image/')) {
      try {
        const thumbPath = path.join(thumbsDir, uniqueFilename);
        await sharp(finalPath)
          .resize(300, 300, { fit: 'inside' })
          .toFile(thumbPath);
      } catch (thumbErr) {
        console.error('生成缩略图失败:', thumbErr);
      }
    }

    // 保存文件信息到数据库
    db.run(
      `INSERT INTO files (filename, original_name, mimetype, size, path, user_id, is_public) 
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [uniqueFilename, filename, mimetype || 'application/octet-stream', fileSize, finalPath, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '保存文件记录失败' });
        }

        // 删除分片记录
        db.run('DELETE FROM chunks WHERE upload_id = ?', [uploadId]);

        const newFile = {
          id: this.lastID,
          filename: uniqueFilename,
          original_name: filename,
          size: fileSize,
          mimetype: mimetype || 'application/octet-stream',
          is_public: 0,
          created_at: new Date().toISOString()
        };

        // 广播文件上传完成事件到该用户的所有会话
        const io = req.app.get('io');
        if (io) {
          const roomName = `user_${userId}`;
          console.log('广播文件上传事件到房间:', roomName, '文件:', newFile.original_name);
          io.to(roomName).emit('file_uploaded', newFile);
        } else {
          console.error('io 实例不存在，无法广播文件上传事件');
        }

        res.json({
          success: true,
          file: newFile
        });
      }
    );
  } catch (error) {
    console.error('合并文件失败:', error);
    res.status(500).json({ error: '合并文件失败' });
  }
};

