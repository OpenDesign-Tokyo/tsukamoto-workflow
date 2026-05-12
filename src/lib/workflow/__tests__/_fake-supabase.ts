/**
 * Lightweight in-memory Supabase mock for unit testing workflow logic.
 * Supports the subset of query-builder methods used by engine.ts:
 *   from / select / insert / update / eq / neq / gt / order / limit / maybeSingle / await
 */

export type Row = Record<string, unknown>

interface Filter { key: string; op: 'eq' | 'neq' | 'gt'; val: unknown }

class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private operation: 'select' | 'insert' | 'update' = 'select'
  private updates: Row = {}
  private inserts: Row[] = []
  private filters: Filter[] = []
  private limitN?: number

  constructor(private store: Record<string, Row[]>, private table: string) {}

  select(..._args: unknown[]) { this.operation = 'select'; void _args; return this }
  insert(rowsOrRow: Row | Row[]) {
    this.operation = 'insert'
    this.inserts = Array.isArray(rowsOrRow) ? rowsOrRow : [rowsOrRow]
    return this
  }
  update(updates: Row) { this.operation = 'update'; this.updates = updates; return this }
  eq(key: string, val: unknown) { this.filters.push({ key, op: 'eq', val }); return this }
  neq(key: string, val: unknown) { this.filters.push({ key, op: 'neq', val }); return this }
  gt(key: string, val: unknown) { this.filters.push({ key, op: 'gt', val }); return this }
  order(..._args: unknown[]) { void _args; return this }
  limit(n: number) { this.limitN = n; return this }

  async maybeSingle() {
    const rows = this._filteredRows()
    return { data: rows[0] ?? null, error: null }
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this._execute().then(onfulfilled as never, onrejected as never)
  }

  private async _execute(): Promise<{ data: unknown; error: null }> {
    if (this.operation === 'insert') {
      if (!this.store[this.table]) this.store[this.table] = []
      this.store[this.table].push(...this.inserts)
      return { data: this.inserts, error: null }
    }
    if (this.operation === 'update') {
      const rows = this._filteredRows()
      for (const r of rows) Object.assign(r, this.updates)
      return { data: rows, error: null }
    }
    let rows = this._filteredRows()
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    return { data: rows, error: null }
  }

  private _filteredRows(): Row[] {
    return (this.store[this.table] || []).filter(r =>
      this.filters.every(f => {
        const v = r[f.key]
        if (f.op === 'eq') return v === f.val
        if (f.op === 'neq') return v !== f.val
        if (f.op === 'gt') return typeof v === 'number' && typeof f.val === 'number' && v > f.val
        return true
      }),
    )
  }
}

export interface FakeSupabaseClient {
  from(table: string): FakeQuery
  _store: Record<string, Row[]>
}

export function createFakeSupabase(seed: Record<string, Row[]> = {}): FakeSupabaseClient {
  const store: Record<string, Row[]> = {}
  for (const [k, v] of Object.entries(seed)) store[k] = v.map(r => ({ ...r }))
  return {
    from(table: string) { return new FakeQuery(store, table) },
    _store: store,
  }
}
