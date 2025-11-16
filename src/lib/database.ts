import path from "node:path";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import initSqlJs, { Database, SqlJsStatic } from "sql.js";

type SqliteContext = {
  SQL: SqlJsStatic;
  db: Database;
  filePath: string;
};

declare global {
  var __SQLITE_CONTEXT__: Promise<SqliteContext> | undefined;
}

const DATABASE_FILE =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "data", "app.db");

async function bootstrapDatabase(): Promise<SqliteContext> {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(process.cwd(), "node_modules/sql.js/dist", file),
  });

  const dir = path.dirname(DATABASE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const dbData = existsSync(DATABASE_FILE)
    ? new Uint8Array(readFileSync(DATABASE_FILE))
    : undefined;

  const db = dbData ? new SQL.Database(dbData) : new SQL.Database();

  // Run migrations (idempotent)
  db.run(`
    CREATE TABLE IF NOT EXISTS payment_sessions (
      session_id TEXT PRIMARY KEY,
      order_id TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_phone TEXT NOT NULL,
      sender_address TEXT NOT NULL,
      receiver_name TEXT NOT NULL,
      receiver_phone TEXT NOT NULL,
      receiver_address TEXT NOT NULL,
      location TEXT NOT NULL,
      weight REAL NOT NULL,
      is_cod INTEGER NOT NULL DEFAULT 1,
      same_day INTEGER NOT NULL DEFAULT 0,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      special_notes TEXT,
      pronto_customer_code TEXT,
      metadata TEXT,
      pronto_tracking_number TEXT,
      pronto_status TEXT,
      pronto_area_code TEXT,
      pronto_cost REAL,
      pronto_payload TEXT,
      pronto_response TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_payment_sessions_order
    ON payment_sessions(order_id);
  `);

  return { SQL, db, filePath: DATABASE_FILE };
}

const contextPromise =
  globalThis.__SQLITE_CONTEXT__ ?? bootstrapDatabase();

globalThis.__SQLITE_CONTEXT__ = contextPromise;

async function getContext(): Promise<SqliteContext> {
  return contextPromise;
}

function persist(ctx: SqliteContext) {
  const data = ctx.db.export();
  writeFileSync(ctx.filePath, Buffer.from(data));
}

export async function runRead<T>(fn: (db: Database) => T): Promise<T> {
  const ctx = await getContext();
  return fn(ctx.db);
}

export async function runWrite<T>(fn: (db: Database) => T): Promise<T> {
  const ctx = await getContext();
  const result = fn(ctx.db);
  persist(ctx);
  return result;
}

export async function resetDatabase(): Promise<void> {
  const ctx = await getContext();
  ctx.db.run("DELETE FROM payment_sessions");
  persist(ctx);
}
