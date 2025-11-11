import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../config/database.js';
import sharp from 'sharp';
import { Worker } from 'worker_threads';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads');
const chunksDir = path.join(uploadsDir, 'chunks');
const filesDir = path.join(uploadsDir, 'files');
const thumbsDir = path.join(uploadsDir, 'thumbs');

// 初始化上传（优化：立即响应，减少延迟）
export const initUpload = (req, res) => {
  const { filename, totalChunks, fileSize, mimetype } = req.body;
  
  if (!filename || !totalChunks || !fileSize) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const uploadId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 立即响应，不做额外处理
  res.json({
    uploadId,
    message: 'Upload initialized'
  });
};

// 上传分片（优化：异步处理数据库，快速响应）
export const uploadChunk = (req, res) => {
  const { uploadId, chunkIndex } = req.body;
  const chunk = req.file;

  if (!uploadId || chunkIndex === undefined || !chunk) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const chunkPath = path.join(chunksDir, `${uploadId}-${chunkIndex}`);

  // 使用异步方式，快速响应客户端
  fs.rename(chunk.path, chunkPath, (err) => {
    if (err) {
      return res.status(500).json({ error: '保存分片失败' });
    }

    // 立即响应客户端，不等待数据库操作
    res.json({ success: true, chunkIndex });

    // 异步保存分片信息到数据库（不阻塞响应）
    db.run(
      'INSERT INTO chunks (upload_id, chunk_index, chunk_path) VALUES (?, ?, ?)',
      [uploadId, chunkIndex, chunkPath],
      (err) => {
        if (err) {
          console.error('保存分片记录失败:', err);
        }
      }
    );
  });
};

// 完成上传，合并分片
export const completeUpload = async (req, res) => {
  const { uploadId, filename, totalChunks, mimetype, source } = req.body;
  const userId = req.user.id;

  if (!uploadId || !filename || !totalChunks) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  // source: 'user' = 我的文件页面上传, 'chat' = 会话中上传
  const fileSource = source || 'user';

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

    // 保存文件信息到数据库
    db.run(
      `INSERT INTO files (filename, original_name, mimetype, size, path, user_id, is_public, source)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [uniqueFilename, filename, mimetype || 'application/octet-stream', fileSize, finalPath, userId, fileSource],
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

        // 立即响应客户端，不等待缩略图生成
        res.json({
          success: true,
          file: newFile
        });

        // 广播文件上传完成事件到该用户的所有会话
        const io = req.app.get('io');
        if (io) {
          const roomName = `user_${userId}`;
          console.log('广播文件上传事件到房间:', roomName, '文件:', newFile.original_name);
          io.to(roomName).emit('file_uploaded', newFile);
        } else {
          console.error('io 实例不存在，无法广播文件上传事件');
        }

        // 异步生成缩略图（不阻塞响应）
        if (mimetype && mimetype.startsWith('image/')) {
          const thumbPath = path.join(thumbsDir, uniqueFilename);
          
          // 使用 setImmediate 确保在下一个事件循环中执行
          setImmediate(async () => {
            try {
              await Promise.all([
                // 标准缩略图 300x300
                sharp(finalPath)
                  .resize(300, 300, { fit: 'inside' })
                  .jpeg({ quality: 80, progressive: true })
                  .toFile(thumbPath),
                
                // 小预览图 100x100
                sharp(finalPath)
                  .resize(100, 100, { fit: 'cover' })
                  .jpeg({ quality: 70, progressive: true })
                  .toFile(thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath)))
              ]);
              
              console.log('缩略图生成完成（异步后台处理）');
            } catch (thumbErr) {
              console.error('生成缩略图失败:', thumbErr);
            }
          });
        }
      }
    );
  } catch (error) {
    console.error('合并文件失败:', error);
    res.status(500).json({ error: '合并文件失败' });
  }
};

// 直接上传（小文件，不分片）
export const directUpload = async (req, res) => {
  const userId = req.user.id;
  const file = req.file;
  const { filename, mimetype, source } = req.body;

  if (!file) {
    return res.status(400).json({ error: '没有上传文件' });
  }
  
  // source: 'user' = 我的文件页面上传, 'chat' = 会话中上传
  const fileSource = source || 'user';

  try {
    const finalPath = file.path;
    const uniqueFilename = file.filename;
    const fileSize = file.size;
    const originalName = filename || file.originalname;
    const fileMimetype = mimetype || file.mimetype || 'application/octet-stream';

    // 保存文件信息到数据库
    db.run(
      `INSERT INTO files (filename, original_name, mimetype, size, path, user_id, is_public, source)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [uniqueFilename, originalName, fileMimetype, fileSize, finalPath, userId, fileSource],
      function(err) {
        if (err) {
          console.error('保存文件记录失败:', err);
          return res.status(500).json({ error: '保存文件记录失败' });
        }

        const newFile = {
          id: this.lastID,
          filename: uniqueFilename,
          original_name: originalName,
          size: fileSize,
          mimetype: fileMimetype,
          is_public: 0,
          created_at: new Date().toISOString()
        };

        // 立即响应客户端
        res.json({
          success: true,
          file: newFile
        });

        // 广播文件上传完成事件
        const io = req.app.get('io');
        if (io) {
          const roomName = `user_${userId}`;
          console.log('[直接上传] 广播文件上传事件到房间:', roomName, '文件:', newFile.original_name);
          io.to(roomName).emit('file_uploaded', newFile);
        }

        // 异步生成缩略图（不阻塞响应）
        if (fileMimetype && fileMimetype.startsWith('image/')) {
          const thumbPath = path.join(thumbsDir, uniqueFilename);
          
          setImmediate(async () => {
            try {
              await Promise.all([
                sharp(finalPath)
                  .resize(300, 300, { fit: 'inside' })
                  .jpeg({ quality: 80, progressive: true })
                  .toFile(thumbPath),
                
                sharp(finalPath)
                  .resize(100, 100, { fit: 'cover' })
                  .jpeg({ quality: 70, progressive: true })
                  .toFile(thumbPath.replace(path.extname(thumbPath), '_small' + path.extname(thumbPath)))
              ]);
              
              console.log('[直接上传] 缩略图生成完成');
            } catch (thumbErr) {
              console.error('[直接上传] 生成缩略图失败:', thumbErr);
            }
          });
        }
      }
    );
  } catch (error) {
    console.error('[直接上传] 失败:', error);
    res.status(500).json({ error: '上传失败' });
  }
};

