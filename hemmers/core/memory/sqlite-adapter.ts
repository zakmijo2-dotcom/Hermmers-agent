/**
 * Universal SQLite Adapter
 * Seamlessly interfaces with better-sqlite3 or node:sqlite (Node 22+)
 */

export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export interface PreparedStatement<T = unknown> {
  run(...params: unknown[]): StatementResult;
  get(...params: unknown[]): T | undefined;
  all(...params: unknown[]): T[];
}

export interface ISqliteDb {
  exec(sql: string): void;
  prepare<T = unknown>(sql: string): PreparedStatement<T>;
  transaction<T>(fn: () => T): () => T;
  close(): void;
  isFts5Available(): boolean;
}

export class SqliteAdapter implements ISqliteDb {
  private db: unknown;
  private isNodeSqlite: boolean = false;
  private hasFts5: boolean = true;

  constructor(dbPath: string = ':memory:') {
    // 1. Try node:sqlite (built into Node 22+)
    try {
      const nodeSqlite = (globalThis as unknown as { process?: { getBuiltinModule?: (name: string) => unknown } })
        .process?.getBuiltinModule?.('node:sqlite') as { DatabaseSync: new (path: string) => unknown } | undefined;

      if (nodeSqlite?.DatabaseSync) {
        this.db = new nodeSqlite.DatabaseSync(dbPath);
        this.isNodeSqlite = true;
        this.initPragmas();
        return;
      }
    } catch {
      // fallback to better-sqlite3
    }

    // 2. Try better-sqlite3
    try {
      // Dynamic require/import for better-sqlite3
      const createBetterSqlite = (
        typeof require !== 'undefined'
          ? require('better-sqlite3')
          : undefined
      ) as ((path: string) => unknown) | undefined;

      if (createBetterSqlite) {
        this.db = createBetterSqlite(dbPath);
        this.isNodeSqlite = false;
        this.initPragmas();
        return;
      }
    } catch {
      // fallback
    }

    // 3. In-process fallback or attempt direct create
    throw new Error(
      `Unable to initialize SQLite database. Neither node:sqlite (Node 22+) nor better-sqlite3 is available.`
    );
  }

  private initPragmas(): void {
    try {
      this.exec('PRAGMA foreign_keys = ON;');
      this.exec('PRAGMA journal_mode = WAL;');
    } catch {
      // Pragmas may fail in some in-memory modes
    }

    // Check FTS5 availability
    try {
      this.exec('CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(test);');
      this.exec('DROP TABLE IF EXISTS _fts5_test;');
      this.hasFts5 = true;
    } catch {
      this.hasFts5 = false;
    }
  }

  exec(sql: string): void {
    const rawDb = this.db as { exec: (s: string) => void };
    rawDb.exec(sql);
  }

  prepare<T = unknown>(sql: string): PreparedStatement<T> {
    const rawDb = this.db as {
      prepare: (s: string) => {
        run: (...args: unknown[]) => StatementResult;
        get: (...args: unknown[]) => T | undefined;
        all: (...args: unknown[]) => T[];
      };
    };

    const stmt = rawDb.prepare(sql);

    return {
      run: (...params: unknown[]) => {
        const res = stmt.run(...params);
        return {
          changes: res?.changes ?? 0,
          lastInsertRowid: res?.lastInsertRowid ?? 0
        };
      },
      get: (...params: unknown[]) => stmt.get(...params),
      all: (...params: unknown[]) => stmt.all(...params)
    };
  }

  transaction<T>(fn: () => T): () => T {
    const rawDb = this.db as {
      transaction?: (f: () => T) => () => T;
    };

    if (typeof rawDb.transaction === 'function') {
      return rawDb.transaction(fn);
    }

    // Manual transaction for engines without built-in transaction wrapper
    return () => {
      this.exec('BEGIN TRANSACTION;');
      try {
        const result = fn();
        this.exec('COMMIT;');
        return result;
      } catch (err) {
        this.exec('ROLLBACK;');
        throw err;
      }
    };
  }

  close(): void {
    const rawDb = this.db as { close: () => void };
    try {
      rawDb.close();
    } catch {
      // ignore
    }
  }

  isFts5Available(): boolean {
    return this.hasFts5;
  }
}
