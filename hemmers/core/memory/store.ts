/**
 * Persistent Memory Store
 * SQLite-backed memory persistence with versioned migrations, foreign keys, and FTS5 search
 */

import { randomUUID } from 'crypto';
import { SqliteAdapter, ISqliteDb } from './sqlite-adapter.js';

export interface MemoryEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'user_input' | 'agent_response' | 'tool_call' | 'tool_result' | 'skill_learned' | 'context' | 'system';
  scope: 'global' | 'project' | 'session' | 'agent';
  content: string;
  importance: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  expiresAt?: number;
  accessCount: number;
  lastAccessedAt: number;
  metadata?: Record<string, unknown>;
  parentId?: string; // Lineage tracking
}

export interface Session {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  parentSessionId?: string; // Session genealogy
  metadata?: Record<string, unknown>;
}

export interface MemoryStoreOptions {
  dbPath?: string;
  db?: ISqliteDb;
}

export interface TurnTransactionData {
  userInput: string;
  assistantResponse: string;
  toolExecutions?: Array<{
    tool: string;
    args: unknown;
    result: unknown;
    success: boolean;
    duration: number;
  }>;
  metadata?: Record<string, unknown>;
}

export class MemoryStore {
  private db: ISqliteDb;
  private readonly dbPath: string;

  constructor(options: string | MemoryStoreOptions = ':memory:') {
    if (typeof options === 'string') {
      this.dbPath = options;
      this.db = new SqliteAdapter(this.dbPath);
    } else {
      this.dbPath = options.dbPath || ':memory:';
      this.db = options.db || new SqliteAdapter(this.dbPath);
    }

    this.runMigrations();
  }

  /**
   * Run versioned migrations
   */
  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);

    const applied = new Set<number>();
    const rows = this.db.prepare<{ version: number }>('SELECT version FROM schema_migrations;').all();
    for (const r of rows) {
      applied.add(r.version);
    }

    // Migration 1: Sessions and Memories tables
    if (!applied.has(1)) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL,
          last_accessed_at INTEGER NOT NULL,
          parent_session_id TEXT,
          metadata TEXT,
          FOREIGN KEY (parent_session_id) REFERENCES sessions(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          type TEXT NOT NULL,
          scope TEXT NOT NULL DEFAULT 'session',
          content TEXT NOT NULL,
          importance REAL NOT NULL DEFAULT 0.5,
          confidence REAL NOT NULL DEFAULT 1.0,
          expires_at INTEGER,
          access_count INTEGER NOT NULL DEFAULT 0,
          last_accessed_at INTEGER NOT NULL,
          metadata TEXT,
          parent_id TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES memories(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
        CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
        CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
        CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp);
        CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
      `);

      // FTS5 Table if available
      if (this.db.isFts5Available()) {
        try {
          this.db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
              content,
              type,
              scope,
              id UNINDEXED,
              session_id UNINDEXED
            );

            CREATE TRIGGER IF NOT EXISTS trg_memories_insert AFTER INSERT ON memories BEGIN
              INSERT INTO memories_fts(content, type, scope, id, session_id)
              VALUES (new.content, new.type, new.scope, new.id, new.session_id);
            END;

            CREATE TRIGGER IF NOT EXISTS trg_memories_delete AFTER DELETE ON memories BEGIN
              DELETE FROM memories_fts WHERE id = old.id;
            END;

            CREATE TRIGGER IF NOT EXISTS trg_memories_update AFTER UPDATE ON memories BEGIN
              DELETE FROM memories_fts WHERE id = old.id;
              INSERT INTO memories_fts(content, type, scope, id, session_id)
              VALUES (new.content, new.type, new.scope, new.id, new.session_id);
            END;
          `);
        } catch {
          // FTS creation skipped if engine lacks module
        }
      }

      this.db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?);').run(1, Date.now());
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create a new session in database
   */
  createSession(parentSessionId?: string, metadata?: Record<string, unknown>): Session {
    const id = randomUUID();
    const now = Date.now();

    let validParentId: string | null = null;
    if (parentSessionId) {
      const parent = this.getSession(parentSessionId);
      if (parent) {
        validParentId = parentSessionId;
      }
    }

    this.db.prepare(`
      INSERT INTO sessions (id, created_at, last_accessed_at, parent_session_id, metadata)
      VALUES (?, ?, ?, ?, ?);
    `).run(
      id,
      now,
      now,
      validParentId,
      metadata ? JSON.stringify(metadata) : null
    );

    return {
      id,
      createdAt: now,
      lastAccessedAt: now,
      parentSessionId: validParentId ?? undefined,
      metadata
    };
  }

  /**
   * Ensure session exists or create it
   */
  ensureSession(sessionId: string, parentSessionId?: string, metadata?: Record<string, unknown>): Session {
    const existing = this.getSession(sessionId);
    if (existing) {
      this.updateSessionAccess(sessionId);
      return existing;
    }

    const now = Date.now();
    this.db.prepare(`
      INSERT INTO sessions (id, created_at, last_accessed_at, parent_session_id, metadata)
      VALUES (?, ?, ?, ?, ?);
    `).run(
      sessionId,
      now,
      now,
      parentSessionId || null,
      metadata ? JSON.stringify(metadata) : null
    );

    return {
      id: sessionId,
      createdAt: now,
      lastAccessedAt: now,
      parentSessionId,
      metadata
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const row = this.db.prepare<{
      id: string;
      created_at: number;
      last_accessed_at: number;
      parent_session_id: string | null;
      metadata: string | null;
    }>('SELECT * FROM sessions WHERE id = ?;').get(sessionId);

    if (!row) return null;

    let metadata: Record<string, unknown> | undefined;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        // ignore
      }
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
      parentSessionId: row.parent_session_id || undefined,
      metadata
    };
  }

  /**
   * Update session last accessed time
   */
  updateSessionAccess(sessionId: string): void {
    this.db.prepare('UPDATE sessions SET last_accessed_at = ? WHERE id = ?;').run(Date.now(), sessionId);
  }

  /**
   * Get session ancestry
   */
  getSessionAncestry(sessionId: string): Session[] {
    const ancestry: Session[] = [];
    let currentId: string | undefined = sessionId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const session = this.getSession(currentId);
      if (!session) break;
      ancestry.push(session);
      currentId = session.parentSessionId;
    }

    return ancestry;
  }

  /**
   * Delete session and all related memories
   */
  deleteSession(sessionId: string): boolean {
    const res = this.db.prepare('DELETE FROM sessions WHERE id = ?;').run(sessionId);
    return res.changes > 0;
  }

  // ==================== MEMORY MANAGEMENT ====================

  /**
   * Add a memory entry
   */
  addMemory(entry: {
    sessionId: string;
    type: MemoryEntry['type'];
    content: string;
    scope?: MemoryEntry['scope'];
    importance?: number;
    confidence?: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
    parentId?: string;
  }): MemoryEntry {
    this.ensureSession(entry.sessionId);

    const id = randomUUID();
    const now = Date.now();
    const scope = entry.scope || 'session';
    const importance = entry.importance ?? 0.5;
    const confidence = entry.confidence ?? 1.0;

    this.db.prepare(`
      INSERT INTO memories (
        id, session_id, timestamp, type, scope, content, importance,
        confidence, expires_at, access_count, last_accessed_at, metadata, parent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?);
    `).run(
      id,
      entry.sessionId,
      now,
      entry.type,
      scope,
      entry.content,
      importance,
      confidence,
      entry.expiresAt || null,
      now,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.parentId || null
    );

    return {
      id,
      sessionId: entry.sessionId,
      timestamp: now,
      type: entry.type,
      scope,
      content: entry.content,
      importance,
      confidence,
      expiresAt: entry.expiresAt,
      accessCount: 0,
      lastAccessedAt: now,
      metadata: entry.metadata,
      parentId: entry.parentId
    };
  }

  /**
   * Record entire turn atomically in one SQLite transaction
   */
  recordTurnTransaction(sessionId: string, turnData: TurnTransactionData): void {
    const runTransaction = this.db.transaction(() => {
      this.ensureSession(sessionId);

      // 1. Record user input
      const userMemory = this.addMemory({
        sessionId,
        type: 'user_input',
        content: turnData.userInput,
        scope: 'session',
        metadata: turnData.metadata
      });

      let parentId = userMemory.id;

      // 2. Record tool executions
      if (turnData.toolExecutions && turnData.toolExecutions.length > 0) {
        for (const exec of turnData.toolExecutions) {
          const toolCallMemory = this.addMemory({
            sessionId,
            type: 'tool_call',
            content: `Tool Call: ${exec.tool}`,
            scope: 'session',
            metadata: { tool: exec.tool, args: exec.args },
            parentId
          });

          const toolResultMemory = this.addMemory({
            sessionId,
            type: 'tool_result',
            content: typeof exec.result === 'string' ? exec.result : JSON.stringify(exec.result),
            scope: 'session',
            metadata: { tool: exec.tool, success: exec.success, duration: exec.duration },
            parentId: toolCallMemory.id
          });

          parentId = toolResultMemory.id;
        }
      }

      // 3. Record assistant response
      this.addMemory({
        sessionId,
        type: 'agent_response',
        content: turnData.assistantResponse,
        scope: 'session',
        metadata: turnData.metadata,
        parentId
      });
    });

    runTransaction();
  }

  /**
   * Get memories by session with options
   */
  getMemories(sessionId: string, options?: {
    type?: string;
    scope?: string;
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }): MemoryEntry[] {
    const { type, scope, limit = 100, offset = 0, includeExpired = false } = options || {};

    let sql = 'SELECT * FROM memories WHERE session_id = ?';
    const params: unknown[] = [sessionId];

    if (!includeExpired) {
      sql += ' AND (expires_at IS NULL OR expires_at > ?)';
      params.push(Date.now());
    }

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (scope) {
      sql += ' AND scope = ?';
      params.push(scope);
    }

    sql += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?;';
    params.push(limit, offset);

    const rows = this.db.prepare<Record<string, unknown>>(sql).all(...params);
    return rows.map(r => this.rowToMemoryEntry(r));
  }

  /**
   * Search memories via FTS5 or LIKE fallback
   */
  searchMemories(query: string, options?: {
    sessionId?: string;
    scope?: string;
    type?: string;
    limit?: number;
  }): MemoryEntry[] {
    const { sessionId, scope, type, limit = 20 } = options || {};

    if (this.db.isFts5Available() && query.trim()) {
      try {
        const sanitizedQuery = query.replace(/[^\w\s]/g, ' ').trim();
        if (sanitizedQuery) {
          const ftsTokens = sanitizedQuery.split(/\s+/).map(t => `"${t}"*`).join(' AND ');

          let ftsSql = `
            SELECT m.* FROM memories m
            JOIN memories_fts f ON m.id = f.id
            WHERE memories_fts MATCH ?
          `;
          const params: unknown[] = [ftsTokens];

          if (sessionId) {
            ftsSql += ' AND m.session_id = ?';
            params.push(sessionId);
          }

          if (scope) {
            ftsSql += ' AND m.scope = ?';
            params.push(scope);
          }

          if (type) {
            ftsSql += ' AND m.type = ?';
            params.push(type);
          }

          ftsSql += ' ORDER BY m.timestamp DESC LIMIT ?;';
          params.push(limit);

          const rows = this.db.prepare<Record<string, unknown>>(ftsSql).all(...params);
          if (rows.length > 0) {
            return rows.map(r => this.rowToMemoryEntry(r));
          }
        }
      } catch {
        // fallback to LIKE query
      }
    }

    // LIKE fallback
    let likeSql = 'SELECT * FROM memories WHERE content LIKE ?';
    const params: unknown[] = [`%${query}%`];

    if (sessionId) {
      likeSql += ' AND session_id = ?';
      params.push(sessionId);
    }

    if (scope) {
      likeSql += ' AND scope = ?';
      params.push(scope);
    }

    if (type) {
      likeSql += ' AND type = ?';
      params.push(type);
    }

    likeSql += ' ORDER BY timestamp DESC LIMIT ?;';
    params.push(limit);

    const rows = this.db.prepare<Record<string, unknown>>(likeSql).all(...params);
    return rows.map(r => this.rowToMemoryEntry(r));
  }

  /**
   * Delete specific memory
   */
  deleteMemory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM memories WHERE id = ?;').run(id);
    return res.changes > 0;
  }

  /**
   * Export all memories
   */
  exportMemories(sessionId?: string): MemoryEntry[] {
    let sql = 'SELECT * FROM memories';
    const params: unknown[] = [];

    if (sessionId) {
      sql += ' WHERE session_id = ?';
      params.push(sessionId);
    }

    sql += ' ORDER BY timestamp ASC;';

    const rows = this.db.prepare<Record<string, unknown>>(sql).all(...params);
    return rows.map(r => this.rowToMemoryEntry(r));
  }

  /**
   * Import memories
   */
  importMemories(entries: MemoryEntry[]): number {
    let count = 0;
    const runTx = this.db.transaction(() => {
      for (const entry of entries) {
        this.ensureSession(entry.sessionId);
        this.db.prepare(`
          INSERT OR REPLACE INTO memories (
            id, session_id, timestamp, type, scope, content, importance,
            confidence, expires_at, access_count, last_accessed_at, metadata, parent_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        `).run(
          entry.id,
          entry.sessionId,
          entry.timestamp,
          entry.type,
          entry.scope,
          entry.content,
          entry.importance,
          entry.confidence,
          entry.expiresAt || null,
          entry.accessCount || 0,
          entry.lastAccessedAt || entry.timestamp,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.parentId || null
        );
        count++;
      }
    });

    runTx();
    return count;
  }

  private rowToMemoryEntry(row: Record<string, unknown>): MemoryEntry {
    let metadata: Record<string, unknown> | undefined;
    if (row.metadata && typeof row.metadata === 'string') {
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        // ignore
      }
    }

    return {
      id: row.id as string,
      sessionId: row.session_id as string,
      timestamp: row.timestamp as number,
      type: row.type as MemoryEntry['type'],
      scope: (row.scope as MemoryEntry['scope']) || 'session',
      content: row.content as string,
      importance: (row.importance as number) ?? 0.5,
      confidence: (row.confidence as number) ?? 1.0,
      expiresAt: (row.expires_at as number) || undefined,
      accessCount: (row.access_count as number) || 0,
      lastAccessedAt: (row.last_accessed_at as number) || (row.timestamp as number),
      metadata,
      parentId: (row.parent_id as string) || undefined
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
