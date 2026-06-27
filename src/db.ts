import './env.js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import * as fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbPath: string;
if (process.env.DB_PATH) {
  dbPath = resolve(process.env.DB_PATH);
} else {
  const dataDir = join(__dirname, '../data');
  dbPath = join(dataDir, 'memory.db');
}

const dbDir = dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Retrieve dimension from env or default to 1536 (OpenAI)
const embeddingDim = process.env.EMBEDDING_DIMENSION || '1536';

db.exec(`
  -- 1. Core memories table
  CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY, -- UUID
      type TEXT NOT NULL,
      scope TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT, -- JSON string array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. FTS virtual table (using hidden rowid)
  CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content='memories'
  );

  -- FTS Sync Triggers
  CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
  END;
  CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  END;
  CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.rowid, old.content);
    INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
  END;

  -- 3. Knowledge Graph Tables
  CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      source_memory_id TEXT NOT NULL, -- Link back to memory
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      FOREIGN KEY(source_memory_id) REFERENCES memories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      source_memory_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      FOREIGN KEY(source_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
      FOREIGN KEY(source_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY(target_id) REFERENCES entities(id) ON DELETE CASCADE
  );
  
  -- Enable foreign keys so cascading works
  PRAGMA foreign_keys = ON;
`);

// Try to create the vector table if sqlite-vec is loaded/available.
// For now we assume we load it elsewhere or just execute it if it exists.
// We will wrap it in try-catch in case vec0 isn't loaded yet.
try {
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_embeddings USING vec0(
        memory_rowid INTEGER PRIMARY KEY,
        embedding float[${embeddingDim}]
    );

    CREATE TRIGGER IF NOT EXISTS memories_emb_ad AFTER DELETE ON memories BEGIN
        DELETE FROM memories_embeddings WHERE memory_rowid = old.rowid;
    END;
  `);
} catch (e: any) {
  // Ignore if vec0 is not installed/loaded in this sqlite instance
  console.warn("sqlite-vec not loaded or available yet. Vector table not created.", e.message);
}
