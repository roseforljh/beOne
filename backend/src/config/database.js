import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database.db');

// 创建数据库连接
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
  }
});

// 初始化数据库表
export const initDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          is_guest INTEGER DEFAULT 0,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建用户表失败:', err);

        // 尝试添加 is_guest 字段（如果表已存在但没有该字段）
        db.run(`ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0`, (err) => {
          // 忽略错误（字段可能已存在）
        });

        // 尝试添加 expires_at 字段
        db.run(`ALTER TABLE users ADD COLUMN expires_at DATETIME`, (err) => {
          // 忽略错误（字段可能已存在）
        });
      });

      // 创建文件表
      db.run(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mimetype TEXT NOT NULL,
          size INTEGER NOT NULL,
          path TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          is_public INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) console.error('创建文件表失败:', err);
      });

      // 创建分片表
      db.run(`
        CREATE TABLE IF NOT EXISTS chunks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          upload_id TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_path TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) console.error('创建分片表失败:', err);
      });

      // 创建消息表
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          content TEXT,
          file_id INTEGER,
          session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (file_id) REFERENCES files (id)
        )
      `, (err) => {
        if (err) console.error('创建消息表失败:', err);

        // 尝试添加 session_id 字段（如果表已存在但没有该字段）
        db.run(`ALTER TABLE messages ADD COLUMN session_id TEXT`, (err) => {
          // 忽略错误（字段可能已存在）
        });
      });

      // 检查是否存在默认用户
      db.get('SELECT * FROM users WHERE username = ?', ['root'], async (err, row) => {
        if (err) {
          console.error('查询用户失败:', err);
          reject(err);
          return;
        }

        if (!row) {
          // 创建默认 root 用户
          const hashedPassword = await bcrypt.hash('123456', 10);
          db.run(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            ['root', hashedPassword],
            (err) => {
              if (err) {
                console.error('创建默认用户失败:', err);
                reject(err);
              } else {
                console.log('默认用户 root 创建成功（密码: 123456）');
                resolve();
              }
            }
          );
        } else {
          console.log('数据库初始化完成');
          resolve();
        }
      });

      // 确保 uploads 目录存在
      const uploadsDir = path.join(__dirname, '../../uploads');
      const chunksDir = path.join(uploadsDir, 'chunks');
      const filesDir = path.join(uploadsDir, 'files');
      const thumbsDir = path.join(uploadsDir, 'thumbs');

      [uploadsDir, chunksDir, filesDir, thumbsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
    });
  });
};

