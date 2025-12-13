import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 支持通过环境变量指定数据库路径
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.db');

// 确保数据库目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接，启用性能优化
export const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
    return;
  }
  
  // 性能优化配置
  db.configure('busyTimeout', 5000);
  
  // 启用 WAL 模式以提高并发性能
  db.run('PRAGMA journal_mode = WAL');
  // 优化同步模式
  db.run('PRAGMA synchronous = NORMAL');
  // 增加缓存大小 (10MB)
  db.run('PRAGMA cache_size = -10000');
  // 启用内存映射 I/O (256MB)
  db.run('PRAGMA mmap_size = 268435456');
  // 优化临时存储
  db.run('PRAGMA temp_store = MEMORY');
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
          email TEXT,
          oauth_provider TEXT,
          oauth_id TEXT,
          is_guest INTEGER DEFAULT 0,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, () => {
        db.run(`ALTER TABLE users ADD COLUMN is_guest INTEGER DEFAULT 0`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN expires_at DATETIME`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN oauth_provider TEXT`, () => {});
        db.run(`ALTER TABLE users ADD COLUMN oauth_id TEXT`, () => {});
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
          source TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, () => {
        db.run(`ALTER TABLE files ADD COLUMN source TEXT DEFAULT 'user'`, () => {});
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
      `);

      // 创建会话表
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);

      // 创建消息表
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          conversation_id INTEGER,
          type TEXT NOT NULL,
          content TEXT,
          file_id INTEGER,
          session_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
          FOREIGN KEY (file_id) REFERENCES files (id)
        )
      `, () => {
        db.run(`ALTER TABLE messages ADD COLUMN session_id TEXT`, () => {});
        db.run(`ALTER TABLE messages ADD COLUMN conversation_id INTEGER`, () => {});
      });

      // 检查是否存在默认用户
      db.get('SELECT * FROM users WHERE username = ?', ['root'], async (err, row) => {
        if (err) {
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
                reject(err);
              } else {
                resolve();
              }
            }
          );
        } else {
          resolve();
        }
      });

      // 创建索引以优化查询性能
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
        'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_files_is_public ON files(is_public)',
        'CREATE INDEX IF NOT EXISTS idx_chunks_upload_id ON chunks(upload_id)',
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_expires_at ON users(expires_at)'
      ];
      
      indexes.forEach(indexSql => {
        db.run(indexSql, () => {});
      });
      
      // 分析表以优化查询计划
      db.run('ANALYZE');

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