/**
 * SQLite-backed persistent memory store with FTS5 full-text search
 * Hermès-style cross-session memory persistence
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'user_input' | 'agent_response' | 'tool_call' | 'tool_result' | 'skill_learned' | 'context';
  content: string;
  metadata?: Record<string, any>;
  parentId?: string; // Lineage tracking
}

export interface Session {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  parentSessionId?: string; // Session genealogy
  metadata?: Record<string, any>;
}

export class MemoryStore {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    // Sessions table with genealogy
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        parent_session_id TEXT,
        metadata TEXT,
        FOREIGN KEY (parent_session_id) REFERENCES sessions(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_parent ON sessions(parent_session_id);
    `);

    // Memory entries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        parent_id TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id),
        FOREIGN KEY (parent_id) REFERENCES memory_entries(id)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_session ON memory_entries(session_id);
      CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(type);
    `);

    // FTS5 virtual table for full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        id UNINDEXED,
        session_id UNINDEXED,
        type UNINDEXED,
        content,
        metadata,
        tokenize = 'porter unicode61'
      );
    `);

    // Trigger to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_fts(id, session_id, type, content, metadata)
        VALUES (new.id, new.session_id, new.type, new.content, new.metadata);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_entries BEGIN
        DELETE FROM memory_fts WHERE id = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries BEGIN
        DELETE FROM memory_fts WHERE id = old.id;
        INSERT INTO memory_fts(id, session_id, type, content, metadata)
        VALUES (new.id, new.session_id, new.type, new.content, new.metadata);
      END;
    `);
  }

  // Session management
  createSession(parentSessionId?: string, metadata?: Record<string, any>): Session {
    const session: Session = {
      id: randomUUID(),
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      parentSessionId,
      metadata
    };

    this.db.prepare(`
      INSERT INTO sessions (id, created_at, last_accessed_at, parent_session_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.createdAt,
      session.lastAccessedAt,
      session.parentSessionId || null,
      session.metadata ? JSON.stringify(session.metadata) : null
    );

    return session;
  }

  getSession(sessionId: string): Session | null {
    const row = this.db.prepare(`
      SELECT id, created_at, last_accessed_at, parent_session_id, metadata
      FROM sessions WHERE id = ?
    `).get(sessionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      parentSessionId: row.parent_session_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  updateSessionAccess(sessionId: string): void {
    this.db.prepare(`
      UPDATE sessions SET last_accessed_at = ? WHERE id = ?
    `).run(Date.now(), sessionId);
  }

  getSessionAncestry(sessionId: string): Session[] {
    const ancestry: Session[] = [];
    let currentId: string | undefined = sessionId;

    while (currentId) {
      const session = this.getSession(currentId);
      if (!session) break;
      ancestry.push(session);
      currentId = session.parentSessionId;
    }

    return ancestry;
  }

  // Memory entry management
  addMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): MemoryEntry {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: Date.now()
    };

    this.db.prepare(`
      INSERT INTO memory_entries (id, session_id, timestamp, type, content, metadata, parent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      fullEntry.id,
      fullEntry.sessionId,
      fullEntry.timestamp,
      fullEntry.type,
      fullEntry.content,
      fullEntry.metadata ? JSON.stringify(fullEntry.metadata) : null,
      fullEntry.parentId || null
    );

    return fullEntry;
  }

  getMemories(sessionId: string, options?: {
    type?: MemoryEntry['type'];
    limit?: number;
    offset?: number;
  }): MemoryEntry[] {
    let query = `SELECT * FROM memory_entries WHERE session_id = ?`;
    const params: any[] = [sessionId];

    if (options?.type) {
      query += ` AND type = ?`;
      params.push(options.type);
    }

    query += ` ORDER BY timestamp DESC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
      if (options?.offset) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.rowToMemoryEntry);
  }

  searchMemories(query: string, options?: {
    sessionId?: string;
    type?: MemoryEntry['type'];
    limit?: number;
  }): MemoryEntry[] {
    // Escape and quote query for FTS5
    const ftsQuery = `"${query.replace(/"/g, '""')}"`;

    let sql = `
      SELECT m.* FROM memory_entries m
      JOIN memory_fts f ON m.id = f.id
      WHERE f.content MATCH ?
    `;
    const params: any[] = [ftsQuery];

    if (options?.sessionId) {
      sql += ` AND m.session_id = ?`;
      params.push(options.sessionId);
    }

    if (options?.type) {
      sql += ` AND m.type = ?`;
      params.push(options.type);
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(options?.limit || 10);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToMemoryEntry);
  }

  private rowToMemoryEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      timestamp: row.timestamp,
      type: row.type,
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      parentId: row.parent_id
    };
  }

  close(): void {
    this.db.close();
  }
}
