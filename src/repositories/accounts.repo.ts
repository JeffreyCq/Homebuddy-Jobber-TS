// src/repositories/accounts.repo.ts
import { Pool } from "pg";

export interface AccountTokens {
  accountId: string;
  accessToken: string;
  refreshToken: string;
  inboundKey: string;
  updatedAt: Date;
}

export interface AccountsRepo {
  get(accountId: string): Promise<AccountTokens | null>;
  save(tokens: AccountTokens): Promise<void>;
  update(accountId: string, patch: Partial<AccountTokens>): Promise<void>;
  delete(accountId: string): Promise<void>;
}

// ⚠️ Si Railway/Neon requieren SSL:
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL_DISABLE ? undefined : { rejectUnauthorized: false }
});

/** Helpers de mapeo snake_case <-> camelCase */
function rowToTokens(row: any): AccountTokens {
  return {
    accountId: row.account_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    inboundKey: row.inbound_key,
    updatedAt: row.updated_at
  };
}

// Mapa de keys TS -> columnas SQL
const COL_MAP: Record<keyof AccountTokens, string> = {
  accountId: "account_id",
  accessToken: "access_token",
  refreshToken: "refresh_token",
  inboundKey: "inbound_key",
  updatedAt: "updated_at"
};

export const PgAccountsRepo = (): AccountsRepo => ({
  async get(id: string) {
    const { rows } = await pool.query(
      `SELECT account_id, access_token, refresh_token, inbound_key, updated_at
       FROM account_tokens WHERE account_id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    return rowToTokens(rows[0]);
  },

  async save(t: AccountTokens) {
    await pool.query(
      `INSERT INTO account_tokens (account_id, access_token, refresh_token, inbound_key, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (account_id) DO UPDATE
       SET access_token = EXCLUDED.access_token,
           refresh_token = EXCLUDED.refresh_token,
           inbound_key  = EXCLUDED.inbound_key,
           updated_at   = NOW()`,
      [t.accountId, t.accessToken, t.refreshToken, t.inboundKey]
    );
  },

  async update(id: string, patch: Partial<AccountTokens>) {
    // Normaliza keys: solo permitimos estas columnas (evita keys desconocidas)
    const allowed: (keyof AccountTokens)[] = ["accessToken", "refreshToken", "inboundKey", "updatedAt"];
    const entries = Object.entries(patch).filter(([k, v]) => allowed.includes(k as any) && v !== undefined);

    if (entries.length === 0) return;

    const sets: string[] = [];
    const values: any[] = [];
    let i = 1;

    for (const [k, v] of entries) {
      const col = COL_MAP[k as keyof AccountTokens];
      // updatedAt lo fuerzas a NOW() si no lo pasas
      if (k === "updatedAt" && v === undefined) continue;
      sets.push(`${col} = $${i++}`);
      values.push(v);
    }

    // Siempre refrescamos updated_at
    sets.push(`updated_at = NOW()`);

    values.push(id);
    const sql = `UPDATE account_tokens SET ${sets.join(", ")} WHERE account_id = $${i}`;
    await pool.query(sql, values);
  },

  async delete(id: string) {
    await pool.query(`DELETE FROM account_tokens WHERE account_id = $1`, [id]);
  }
});
