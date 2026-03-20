/**
 * Minimal Turso HTTP client using fetch().
 * Replaces @libsql/client to avoid bundling issues on Cloudflare Workers.
 */

export type InValue = string | number | null | boolean;
export type InStatement = string | { sql: string; args?: InValue[] };

export interface ResultSet {
  rows: Record<string, unknown>[];
  lastInsertRowid: number | null;
  rowsAffected: number;
}

export interface TursoClient {
  execute(stmt: InStatement): Promise<ResultSet>;
  batch(stmts: InStatement[], mode?: string): Promise<ResultSet[]>;
}

function encodeValue(v: InValue): { type: string; value?: string | number } {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) };
    return { type: 'float', value: v };
  }
  return { type: 'text', value: String(v) };
}

function decodeValue(v: { type: string; value?: string }): unknown {
  if (v.type === 'null') return null;
  if (v.type === 'integer') return Number(v.value);
  if (v.type === 'float') return Number(v.value);
  if (v.type === 'blob') return v.value;
  return v.value ?? null;
}

function normalizeStmt(stmt: InStatement): { sql: string; args: InValue[] } {
  if (typeof stmt === 'string') return { sql: stmt, args: [] };
  return { sql: stmt.sql, args: stmt.args || [] };
}

interface TursoResponse {
  results: Array<{
    type: 'ok' | 'error';
    response?: {
      type: string;
      result: {
        cols: { name: string }[];
        rows: Array<Array<{ type: string; value?: string }>>;
        affected_row_count: number;
        last_insert_rowid: string | null;
      };
    };
    error?: { message: string; code: string };
  }>;
}

function parseResult(raw: TursoResponse['results'][0]): ResultSet {
  if (raw.type === 'error') {
    throw new Error(`Turso error: ${raw.error?.message || 'unknown'}`);
  }
  const result = raw.response!.result;
  const colNames = result.cols.map(c => c.name);
  const rows = result.rows.map(row => {
    const obj: Record<string, unknown> = {};
    row.forEach((val, i) => {
      obj[colNames[i]] = decodeValue(val);
    });
    return obj;
  });
  return {
    rows,
    lastInsertRowid: result.last_insert_rowid ? Number(result.last_insert_rowid) : null,
    rowsAffected: result.affected_row_count,
  };
}

export function createTursoClient(url: string, authToken?: string): TursoClient {
  // Convert libsql:// to https://
  let baseUrl = url;
  if (baseUrl.startsWith('libsql://')) {
    baseUrl = baseUrl.replace('libsql://', 'https://');
  }
  const pipelineUrl = `${baseUrl}/v2/pipeline`;

  async function request(requests: Array<{ type: string; stmt?: { sql: string; args?: Array<{ type: string; value?: string | number }> } }>): Promise<TursoResponse> {
    const res = await fetch(pipelineUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ requests }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Turso HTTP ${res.status}: ${text}`);
    }

    return res.json() as Promise<TursoResponse>;
  }

  return {
    async execute(stmt: InStatement): Promise<ResultSet> {
      const { sql, args } = normalizeStmt(stmt);
      const response = await request([{
        type: 'execute',
        stmt: { sql, args: args.map(encodeValue) },
      }, { type: 'close' }]);
      return parseResult(response.results[0]);
    },

    async batch(stmts: InStatement[], mode?: string): Promise<ResultSet[]> {
      const requests: Array<{ type: string; stmt?: { sql: string; args?: Array<{ type: string; value?: string | number }> } }> = [];
      for (const stmt of stmts) {
        const { sql, args } = normalizeStmt(stmt);
        requests.push({
          type: 'execute',
          stmt: { sql, args: args.map(encodeValue) },
        });
      }
      requests.push({ type: 'close' });
      const response = await request(requests);
      return response.results.slice(0, stmts.length).map(parseResult);
    },
  };
}
