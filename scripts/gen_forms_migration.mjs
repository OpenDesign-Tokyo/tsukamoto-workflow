// ============================================================================
// 帳票フルリフレッシュ migration ジェネレータ
// 条件書「ワークフロー一覧260617v1.xlsx」に基づき #1〜#35 の書類種別・承認ルート・
// 配信先(observers) を生成する。node scripts/gen_forms_migration.mjs で SQL を出力。
// ============================================================================
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'supabase', 'migrations', '20260702000001_forms_full_refresh.sql')

// ---- SQL文字列エスケープ ----
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const jsonb = (obj) => `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`

// ---- 承認者/配信先のトークン定義 ----
// pos: 役職相対解決 / email: 特定従業員
const A = {
  kacho:        { type: 'position_in_department',        pos: 'KACHO' }, // 所属課長/営業課長(相対)
  bucho:        { type: 'position_in_parent_department', pos: 'BUCHO' }, // 所属部長/営業部長(相対)
  jigyobucho:   { type: 'specific_employee', email: 's-kuroki@tsukamoto.co.jp' },   // 事業部長
  ks_bucho:     { type: 'specific_employee', email: 'a-saito@tsukamoto.co.jp' },    // 企画生産部長
  kikaku_kacho: { type: 'specific_employee', email: 'hi-takahashi@tsukamoto.co.jp' }, // 企画課長
  eigyo_bucho:  { type: 'specific_employee', email: 'h-mitsuta@tsukamoto.co.jp' },  // 営業部長(固定/配信用)
  md:           { type: 'specific_employee', email: 'hi-takahashi@tsukamoto.co.jp' }, // 担当MD/企画MD
  patanner:     { type: 'specific_employee', email: 'h-omori@tsukamoto.co.jp' },    // 担当パタンナー
  seisan:       { type: 'specific_employee', email: 'y-mito@tsukamoto.co.jp' },     // 生産担当
  rental_kacho: { type: 'specific_employee', email: 'h-mitsuta@tsukamoto.co.jp' },  // レンタル課長
  gyomu_bucho:  { type: 'specific_employee', email: 'gyomu-bucho@tsukamoto.co.jp' },// 業務部長(ダミー)
  kansa:        { type: 'specific_employee', email: 'kansa@tsukamoto.co.jp' },      // 監査室(ダミー)
  jinji:        { type: 'specific_employee', email: 'jinji@tsukamoto.co.jp' },      // 本部人事課(ダミー)
  joushis:      { type: 'specific_employee', email: 'joshis@tsukamoto.co.jp' },     // 情シス(ダミー)
  rental_sys:   { type: 'specific_employee', email: 'rental-sys@tsukamoto.co.jp' }, // レンタルシステム担当(ダミー)
  bucho_obs:    { type: 'position_in_parent_department', pos: 'BUCHO' }, // 所属部長(配信/相対)
}

// assignee 用の position_id / employee_id サブクエリ SQL片
const posId = (code) => `(SELECT id FROM positions WHERE code = ${q(code)})`
const empId = (email) => `(SELECT id FROM employees WHERE email = ${q(email)})`

// ---- 共通スキーマ部品 ----
const F = {
  text: (id, label, required = false, extra = {}) => ({ id, type: 'text', label, required, ...extra }),
  textarea: (id, label, required = false, rows = 3) => ({ id, type: 'textarea', label, required, rows }),
  date: (id, label, required = false) => ({ id, type: 'date', label, required }),
  num: (id, label, required = false) => ({ id, type: 'number', label, required }),
  cur: (id, label, required = false) => ({ id, type: 'currency', label, required }),
  sel: (id, label, options, required = false) => ({ id, type: 'select', label, required, options: options.map(o => (typeof o === 'string' ? { value: o, label: o } : o)) }),
}
const sections = (arr) => ({ type: 'sections', sections: arr.map(([title, fields]) => ({ title, fields })) })

// 金額分岐フォーム用の明細テーブルスキーマ
function tableAmountSchema(tableId, tableLabel, cols) {
  const columns = cols
  return {
    version: '1.0',
    fields: [
      F.text('project_name', '案件名', true),
      F.text('customer_name', '顧客名', true),
      { id: tableId, type: 'table', label: tableLabel, columns, minRows: 1, maxRows: 50 },
      { id: 'total_amount', type: 'formula', label: '合計金額', formula: `SUM(${tableId}.subtotal)` },
      F.date('delivery_date', '納期', true),
      F.textarea('remarks', '備考', false, 3),
    ],
    layout: sections([
      ['基本情報', ['project_name', 'customer_name']],
      ['明細', [tableId, 'total_amount']],
      ['納期・備考', ['delivery_date', 'remarks']],
    ]),
  }
}

// ---- 明細列テンプレート ----
const colsEstimate = [
  { id: 'item_name', type: 'text', label: '品名', width: '30%' },
  { id: 'spec', type: 'text', label: '仕様', width: '20%' },
  { id: 'quantity', type: 'number', label: '数量', width: '10%' },
  { id: 'unit_price', type: 'currency', label: '単価', width: '15%' },
  { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '15%' },
]
const colsSize = [
  { id: 'size', type: 'text', label: 'サイズ', width: '20%' },
  { id: 'quantity', type: 'number', label: '数量', width: '20%' },
  { id: 'unit_price', type: 'currency', label: '単価', width: '20%' },
  { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '20%' },
]
const colsFabric = [
  { id: 'fabric_name', type: 'text', label: '生地名', width: '20%' },
  { id: 'color', type: 'text', label: '色', width: '15%' },
  { id: 'quantity', type: 'number', label: '数量(m)', width: '15%' },
  { id: 'unit_price', type: 'currency', label: '単価', width: '15%' },
  { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '15%' },
]
const colsAccessory = [
  { id: 'item_name', type: 'text', label: '品名', width: '20%' },
  { id: 'spec', type: 'text', label: '仕様', width: '20%' },
  { id: 'quantity', type: 'number', label: '数量', width: '15%' },
  { id: 'unit_price', type: 'currency', label: '単価', width: '15%' },
  { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '15%' },
]
const colsProcessing = [
  { id: 'item_name', type: 'text', label: '品名', width: '20%' },
  { id: 'process_type', type: 'text', label: '加工種別', width: '15%' },
  { id: 'spec', type: 'text', label: '仕様', width: '15%' },
  { id: 'quantity', type: 'number', label: '数量', width: '10%' },
  { id: 'unit_price', type: 'currency', label: '単価', width: '15%' },
  { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '15%' },
]

// compute_from ヘルパ
const cond = (min, max, table) => {
  const c = { amount_field: 'total_amount', compute_from: { table, sum_column: 'subtotal' } }
  if (min != null) c.min = min
  if (max != null) c.max = max
  return c
}

// ============================================================================
// 新規スキーマ (T19〜T36)
// ============================================================================
const S = {}
S.T19 = { version: '1.0', fields: [
  F.text('affiliation', '所属', true), F.text('expense_code', '経費コード'),
  F.text('vehicle', '車両（レンタカー/カーシェア/自家用車 等）', true),
  { id: 'trips', type: 'table', label: '運行明細', columns: [
    { id: 'date', type: 'date', label: '日付', width: '15%' },
    { id: 'start_time', type: 'text', label: '開始予定', width: '12%' },
    { id: 'end_time', type: 'text', label: '終了予定', width: '12%' },
    { id: 'from', type: 'text', label: '乗車場所', width: '15%' },
    { id: 'to', type: 'text', label: '行き先', width: '18%' },
    { id: 'passengers', type: 'text', label: '同乗者', width: '13%' },
    { id: 'reason', type: 'text', label: '理由', width: '15%' },
  ], minRows: 1, maxRows: 30 },
  F.textarea('remarks', '備考（自家用車の場合は保険証券の写しを添付）', false, 3),
], layout: sections([['申請者情報', ['affiliation', 'expense_code', 'vehicle']], ['運行予定', ['trips']], ['備考', ['remarks']]]) }

S.T20 = { version: '1.0', fields: [
  F.text('target_name', '調査先 社名', true), F.text('target_address', '調査先 住所'),
  F.text('target_rep', '代表者名'), F.text('target_tel', 'TEL'),
  F.sel('survey_type', '調査種類', ['簡易版基本データ(2期分)', '簡易版基本データ(3〜6期)', '調査コピー', '調査(普通/特急/超特急)'], true),
  F.textarea('purpose', '調査目的', true, 3), F.text('expense_code', '経費コード'),
  F.textarea('remarks', '特記事項', false, 2),
], layout: sections([['調査先', ['target_name', 'target_address', 'target_rep', 'target_tel']], ['調査内容', ['survey_type', 'purpose']], ['その他', ['expense_code', 'remarks']]]) }

S.T21 = { version: '1.0', fields: [
  F.sel('kubun', '区分', ['得意先 登録', '得意先 変更', '仕入先 登録', '仕入先 変更'], true),
  F.text('current_account_no', '現口座No.'), F.text('current_account_name', '現口座名'),
  F.textarea('request_detail', '申請事項・理由', true, 4), F.text('department_name', '部門名', true),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['申請区分', ['kubun', 'current_account_no', 'current_account_name']], ['申請内容', ['request_detail', 'department_name']], ['備考', ['remarks']]]) }

S.T22 = { version: '1.0', fields: [
  F.text('warehouse', '所在地・倉庫名', true), F.text('company_name', '社名', true),
  { id: 'items', type: 'table', label: '寄託商品明細', columns: [
    { id: 'code', type: 'text', label: 'コード番号', width: '25%' },
    { id: 'product_name', type: 'text', label: '商品名', width: '45%' },
    { id: 'quantity', type: 'number', label: '数量', width: '15%' },
  ], minRows: 1, maxRows: 50 },
  { id: 'total_qty', type: 'formula', label: '合計数量', formula: 'SUM(items.quantity)' },
  F.date('deposit_from', '寄託期間 開始', true), F.date('deposit_to', '寄託期間 終了', true),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['寄託先', ['warehouse', 'company_name']], ['寄託明細', ['items', 'total_qty']], ['期間・備考', ['deposit_from', 'deposit_to', 'remarks']]]) }

S.T23 = { version: '1.0', fields: [
  F.text('customer_name', '得意先名', true), F.date('effective_date', '変更適用日', true),
  F.textarea('change_before', '変更前（住所/社名/代表者/取引条件）', true, 4),
  F.textarea('change_after', '変更後', true, 4),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['得意先', ['customer_name', 'effective_date']], ['変更内容', ['change_before', 'change_after']], ['備考', ['remarks']]]) }

S.T24 = { version: '1.0', fields: [
  F.text('warehouse', '倉庫・取引先', true), F.text('project_name', '案件名', true),
  F.sel('direction', '振替方向', ['当社在庫 → 先品', '先品 → 当社在庫'], true),
  { id: 'items', type: 'table', label: '振替明細', columns: [
    { id: 'product_name', type: 'text', label: '品名', width: '20%' },
    { id: 'product_no', type: 'text', label: '品番', width: '15%' },
    { id: 'size', type: 'text', label: 'サイズ', width: '10%' },
    { id: 'color', type: 'text', label: 'カラー', width: '10%' },
    { id: 'quantity', type: 'number', label: '数量', width: '10%' },
    { id: 'unit_price', type: 'currency', label: '単価', width: '13%' },
    { id: 'subtotal', type: 'formula', label: '金額', formula: 'quantity * unit_price', width: '12%' },
    { id: 'note', type: 'text', label: '摘要', width: '10%' },
  ], minRows: 1, maxRows: 50 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(items.subtotal)' },
  F.sel('senpin_type', '先品種別', ['A', 'B']),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['基本情報', ['warehouse', 'project_name', 'direction']], ['明細', ['items', 'total_amount']], ['区分・備考', ['senpin_type', 'remarks']]]) }

S.T25 = { version: '1.0', fields: [
  F.text('vendor_name', '加工先', true), F.text('product_no', '品番', true), F.text('product_name', '品名', true),
  F.text('user_name', 'ユーザー'), F.date('delivery_date', '納期', true),
  F.text('warehouse', '倉庫'), F.text('factory', '工場'),
  { id: 'size_table', type: 'table', label: 'サイズ明細', columns: [
    { id: 'size', type: 'text', label: 'サイズ', width: '20%' },
    { id: 'quantity', type: 'number', label: '着数', width: '20%' },
    { id: 'note', type: 'text', label: '寸法・備考', width: '55%' },
  ], minRows: 1, maxRows: 30 },
  F.textarea('spec', '仕様・納品での注意事項', true, 5),
], layout: sections([['加工先情報', ['vendor_name', 'product_no', 'product_name', 'user_name']], ['納品情報', ['delivery_date', 'warehouse', 'factory']], ['サイズ・仕様', ['size_table', 'spec']]]) }

S.T26 = { version: '1.0', fields: [
  F.text('division_name', '事業部名', true), F.text('sales_target', '販売先名', true), F.text('address', '住所'),
  F.text('tel', 'TEL'), F.text('introducer', '紹介者'), F.text('relationship', '販売先との関係'),
  F.cur('estimated_amount', '販売概算額', true), F.date('collection_date', '回収日', true),
  F.sel('collection_method', '回収方法', ['現金引換', '買掛相殺', '振込', 'その他(一部延払等)'], true),
  F.text('collection_manager', '回収責任者', true), F.textarea('remarks', '備考（伝票番号等）', false, 2),
], layout: sections([['販売先', ['division_name', 'sales_target', 'address', 'tel', 'introducer', 'relationship']], ['回収', ['estimated_amount', 'collection_date', 'collection_method', 'collection_manager']], ['備考', ['remarks']]]) }

S.T27 = { version: '1.0', fields: [
  F.text('affiliation', '所属', true), F.textarea('items', '購入希望物品・数量（メーカー・品番等）', true, 4),
  F.textarea('purpose', '用途', false, 2), F.sel('urgency', '緊急度', ['急ぐ', '急がない'], true),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['申請者', ['affiliation']], ['購入内容', ['items', 'purpose', 'urgency']], ['備考', ['remarks']]]) }

S.T28 = { version: '1.0', fields: [
  F.text('warehouse', '倉庫名', true), F.text('customer_name', 'お客様名', true),
  { id: 'items', type: 'table', label: '廃棄明細', columns: [
    { id: 'product_no', type: 'text', label: '品番', width: '15%' },
    { id: 'product_name', type: 'text', label: '商品名', width: '25%' },
    { id: 'size', type: 'text', label: 'サイズ', width: '10%' },
    { id: 'quantity', type: 'number', label: '数量', width: '10%' },
    { id: 'unit_price', type: 'currency', label: '単価', width: '13%' },
    { id: 'subtotal', type: 'formula', label: '計', formula: 'quantity * unit_price', width: '12%' },
    { id: 'reason', type: 'text', label: '理由', width: '15%' },
  ], minRows: 1, maxRows: 50 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(items.subtotal)' },
  F.textarea('contact_note', '連絡事項', false, 3),
], layout: sections([['依頼先', ['warehouse', 'customer_name']], ['廃棄明細', ['items', 'total_amount']], ['連絡事項', ['contact_note']]]) }

S.T29 = { version: '1.0', fields: [
  F.text('sales_dept', '所属課', true), F.date('occurrence_date', '発生日', true), F.text('sales_target', '販売先', true),
  F.cur('base_limit', '基本限度', true), F.textarea('content', '内容', true, 3),
  F.textarea('cause', '原因', true, 3), F.textarea('countermeasure', '対策', true, 3),
], layout: sections([['基本情報', ['sales_dept', 'occurrence_date', 'sales_target', 'base_limit']], ['報告', ['content', 'cause', 'countermeasure']]]) }

S.T30 = { version: '1.0', fields: [
  F.text('affiliation', '所属', true), F.date('entertain_date', '接待予定日', true), F.text('customer_name', '得意先名', true),
  F.text('customer_contact', '先方担当者'), F.num('customer_count', '得意先人数'), F.num('our_count', '当方人数'),
  F.cur('planned_amount', '予定金額（税別）', true), F.textarea('content', '内容', true, 3), F.cur('actual_amount', '実費金額'),
], layout: sections([['申請者', ['affiliation']], ['接待情報', ['entertain_date', 'customer_name', 'customer_contact', 'customer_count', 'our_count']], ['金額・内容', ['planned_amount', 'content', 'actual_amount']]]) }

S.T31 = { version: '1.0', fields: [
  { id: 'items', type: 'table', label: '品番登録明細', columns: [
    { id: 'sales_section', type: 'text', label: '販売係', width: '8%' },
    { id: 'window_code', type: 'text', label: '窓口コード', width: '11%' },
    { id: 'window_name', type: 'text', label: '納入窓口名', width: '16%' },
    { id: 'sales_type', type: 'text', label: '販売区分', width: '9%' },
    { id: 'user_name', type: 'text', label: 'ユーザー名', width: '14%' },
    { id: 'product_type', type: 'text', label: '商品区分', width: '8%' },
    { id: 'product_no', type: 'text', label: '品番', width: '9%' },
    { id: 'product_name', type: 'text', label: '品名', width: '15%' },
    { id: 'category', type: 'text', label: 'カテゴリー', width: '10%' },
  ], minRows: 1, maxRows: 50 },
  F.textarea('fabric_note', '生地の場合：仕入先・生地品番・色番', false, 2),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['品番登録', ['items']], ['補足', ['fabric_note', 'remarks']]]) }

S.T32 = { version: '1.0', fields: [
  F.text('user_name', 'ユーザー', true), F.date('order_date', '受注日'), F.date('end_date', '終了日', true),
  { id: 'products', type: 'table', label: '製品在庫明細', columns: [
    { id: 'product_name', type: 'text', label: '製品名', width: '25%' },
    { id: 'product_no', type: 'text', label: '品番', width: '15%' },
    { id: 'price', type: 'currency', label: '売価', width: '15%' },
    { id: 'cost', type: 'currency', label: 'コスト', width: '15%' },
    { id: 'stock_qty', type: 'number', label: '在庫合計', width: '15%' },
    { id: 'cost_total', type: 'formula', label: 'コスト合計', formula: 'cost * stock_qty', width: '15%' },
  ], minRows: 1, maxRows: 50 },
  F.textarea('final_handling', '最終処理方法・費用負担', true, 3), F.textarea('remarks', '備考', false, 2),
], layout: sections([['案件情報', ['user_name', 'order_date', 'end_date']], ['在庫明細', ['products']], ['処理・備考', ['final_handling', 'remarks']]]) }

S.T33 = { version: '1.0', fields: [
  F.text('cost_code', '係コード'), F.sel('item', '項目', ['運搬', '物流', '検品', '企画', '他'], true),
  F.text('property_name', '物件名', true), F.text('payee', '支払先', true), F.textarea('content', '内容', true, 3),
  F.sel('cost_bearer', '費用負担', ['先方', '当社', 'メーカー'], true), F.textarea('allocation', '分担詳細', false, 2),
  F.date('planned_date', '処理予定日', true), F.cur('amount', '金額', true), F.sel('method', '処理方法', ['経費', '仕入']),
  F.textarea('remarks', '備考', false, 2),
], layout: sections([['申請情報', ['cost_code', 'item', 'property_name', 'payee']], ['費用', ['content', 'cost_bearer', 'allocation', 'planned_date', 'amount', 'method']], ['備考', ['remarks']]]) }

const productTable = { id: 'products', type: 'table', label: '製品情報', columns: [
  { id: 'item_name', type: 'text', label: 'アイテム名称', width: '30%' },
  { id: 'product_no', type: 'text', label: '品番', width: '25%' },
  { id: 'size_range', type: 'text', label: 'サイズ展開', width: '45%' },
], minRows: 1, maxRows: 30 }

S.T34 = { version: '1.0', fields: [
  F.text('dept', '起票部門', true), F.text('drafter', '起票者名', true), F.text('user_name', 'ユーザー名', true),
  F.text('channel', '直需 / 代理店名'), F.sel('operation', '運用形態', ['レンタル', '販売', 'その他']),
  F.date('wear_start', '着用開始日'), F.date('build_deadline', '本番作成期日', true),
  productTable,
  F.sel('approval_needed', '承認機能の要否', ['要', '不要', '未定'], true), F.text('approval_layers', '承認者の階層'),
  F.text('approval_flow', '承認の流れ'), F.sel('stock_display', '在庫表示の要否', ['要', '不要']),
  F.textarea('remarks', 'その他要望・特記事項', false, 3),
], layout: sections([['起票情報', ['dept', 'drafter', 'user_name', 'channel']], ['案件基本情報', ['operation', 'wear_start', 'build_deadline']], ['製品情報', ['products']], ['申請方法', ['approval_needed', 'approval_layers', 'approval_flow', 'stock_display']], ['その他', ['remarks']]]) }

S.T35 = { version: '1.0', fields: [
  F.text('dept', '起票部門', true), F.text('drafter', '起票者名', true), F.text('user_name', 'ユーザー名', true),
  F.text('channel', '直需 / 代理店名'), F.sel('operation', '運用形態', ['レンタル', '販売', 'その他']),
  F.date('wear_start', '着用開始日'), F.date('repair_deadline', '改修期日', true),
  F.text('estimate_no', '見積書No.'), F.cur('total_amount', '改修総額', true),
  { id: 'repairs', type: 'table', label: '改修内容', columns: [
    { id: 'no', type: 'text', label: '番号', width: '10%' },
    { id: 'content', type: 'text', label: '改修内容', width: '65%' },
    { id: 'amount', type: 'currency', label: '改修金額', width: '25%' },
  ], minRows: 1, maxRows: 30 },
  F.textarea('remarks', '備考（見積書を添付）', false, 3),
], layout: sections([['起票情報', ['dept', 'drafter', 'user_name', 'channel']], ['案件基本情報', ['operation', 'wear_start', 'repair_deadline']], ['改修内容', ['estimate_no', 'total_amount', 'repairs']], ['その他', ['remarks']]]) }

S.T36 = { version: '1.0', fields: [
  F.text('dept', '起票所属', true), F.text('drafter', '起票者名', true), F.text('user_name', 'ユーザー名', true),
  F.text('channel', '直需 / 代理店名'), F.sel('operation', '運用形態', ['レンタル', '販売', 'その他']),
  F.date('wear_start', '着用開始日'), F.date('build_deadline', '本番作成期日', true),
  productTable,
  F.text('management_unit', '管理単位（店舗毎/個人毎 等）'), F.text('employee_type', '社員区分'),
  F.sel('approval_needed', '承認機能の要否', ['要', '不要', '未定'], true), F.text('approval_layers', '承認者の階層'),
  F.text('approval_flow', '承認の流れ'), F.textarea('remarks', 'その他要望・特記事項（送り先情報は別途添付）', false, 3),
], layout: sections([['起票情報', ['dept', 'drafter', 'user_name', 'channel']], ['案件基本情報', ['operation', 'wear_start', 'build_deadline']], ['製品情報', ['products']], ['管理方法', ['management_unit', 'employee_type']], ['承認機能', ['approval_needed', 'approval_layers', 'approval_flow']], ['その他', ['remarks']]]) }

// 金額分岐フォームのスキーマ
S.T02 = { version: '1.0', fields: [
  F.text('project_name', '案件名', true), F.text('customer_name', '顧客名', true),
  { id: 'estimate_items', type: 'table', label: '見積明細', columns: colsEstimate, minRows: 1, maxRows: 50 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(estimate_items.subtotal)' },
  F.date('valid_until', '有効期限', true), F.textarea('remarks', '備考', false, 3),
], layout: sections([['基本情報', ['project_name', 'customer_name']], ['見積明細', ['estimate_items', 'total_amount']], ['条件', ['valid_until', 'remarks']]]) }
S.T09 = { version: '1.0', fields: [
  F.text('project_name', '案件名', true), F.textarea('pattern_spec', 'パターン仕様', true, 6),
  { id: 'size_table', type: 'table', label: 'サイズ展開', columns: colsSize, minRows: 1, maxRows: 20 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(size_table.subtotal)' },
  F.textarea('remarks', '備考', false, 3),
], layout: sections([['基本情報', ['project_name']], ['パターン仕様', ['pattern_spec', 'size_table', 'total_amount']], ['備考', ['remarks']]]) }
S.T10 = { version: '1.0', fields: [
  F.text('vendor_name', '発注先', true), F.text('project_name', '案件名', true),
  { id: 'fabric_items', type: 'table', label: '生地明細', columns: colsFabric, minRows: 1, maxRows: 30 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(fabric_items.subtotal)' },
  F.date('delivery_date', '希望納期', true), F.textarea('remarks', '備考', false, 3),
], layout: sections([['発注先情報', ['vendor_name', 'project_name']], ['生地明細', ['fabric_items', 'total_amount']], ['納期・備考', ['delivery_date', 'remarks']]]) }
S.T11 = { version: '1.0', fields: [
  F.text('vendor_name', '発注先', true), F.text('project_name', '案件名', true),
  { id: 'accessory_items', type: 'table', label: '付属明細', columns: colsAccessory, minRows: 1, maxRows: 30 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(accessory_items.subtotal)' },
  F.date('delivery_date', '希望納期', true), F.textarea('remarks', '備考（付属明細書を必ず添付）', false, 3),
], layout: sections([['発注先情報', ['vendor_name', 'project_name']], ['付属明細', ['accessory_items', 'total_amount']], ['納期・備考', ['delivery_date', 'remarks']]]) }
S.T12 = { version: '1.0', fields: [
  F.text('project_name', '案件名', true), F.text('customer_name', '顧客名', true),
  { id: 'processing_items', type: 'table', label: '加工明細', columns: colsProcessing, minRows: 1, maxRows: 30 },
  { id: 'total_amount', type: 'formula', label: '合計金額', formula: 'SUM(processing_items.subtotal)' },
  F.date('delivery_date', '納期', true), F.textarea('remarks', '備考', false, 3),
], layout: sections([['基本情報', ['project_name', 'customer_name']], ['加工明細', ['processing_items', 'total_amount']], ['納期・備考', ['delivery_date', 'remarks']]]) }

// ============================================================================
// フォーム定義（#1〜#35）
//  isNew:true = 新規 document_type / false = 既存 dt を再有効化＆整合
//  routes[].approvers = [[label, token], ...] / observers = [[label, token], ...]
// ============================================================================
const forms = [
  // ---- 既存 (再有効化＋整合) ----
  { code: 'T01', name: 'デザイン企画依頼書', category: '業務依頼', icon: 'lightbulb', sort: 1, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['企画生産部長', 'ks_bucho'], ['企画課長', 'kikaku_kacho']],
      observers: [['生産担当', 'seisan'], ['企画MD', 'md'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T02', name: '見積書', category: '見積', icon: 'file-text', sort: 2, isNew: true, schema: 'T02', amountTable: 'estimate_items', routes: [
    { name: '見積書 承認ルート（1000万未満）', isDefault: true, approvers: [['営業課長', 'kacho']], observers: [] },
    { name: '見積書 承認ルート（1000〜3000万）', condition: cond(10000000, 30000000, 'estimate_items'), approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho']], observers: [] },
    { name: '見積書 承認ルート（3000万以上）', condition: cond(30000000, null, 'estimate_items'), approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['事業部長', 'jigyobucho']], observers: [] },
  ]},
  { code: 'T03', name: '生地手配依頼書', category: '業務依頼', icon: 'package', sort: 3, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['企画生産部長', 'ks_bucho']], observers: [['生産担当', 'seisan']] },
  ]},
  { code: 'T04', name: '仕様変更依頼書', category: '業務依頼', icon: 'edit', sort: 4, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['企画生産部長', 'ks_bucho'], ['生産担当', 'seisan'], ['企画課長', 'kikaku_kacho']], observers: [['担当パタンナー', 'patanner']] },
  ]},
  { code: 'T04b', name: '仕様修正依頼書', category: '業務依頼', icon: 'edit', sort: 5, isNew: false, routes: [
    { approvers: [['企画生産部長', 'ks_bucho'], ['企画課長', 'kikaku_kacho']], observers: [['担当パタンナー', 'patanner']] },
  ]},
  { code: 'T05', name: 'コンペ結果報告書', category: '社内申請', icon: 'clipboard-check', sort: 6, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['担当MD', 'md']], observers: [['営業部長', 'eigyo_bucho'], ['企画生産部長', 'ks_bucho'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T06', name: 'クレーム報告書', category: '社内申請', icon: 'alert-triangle', sort: 7, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['企画生産部長', 'ks_bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T08', name: '企画外注向け注文書', category: '業務依頼', icon: 'shopping-cart', sort: 8, isNew: false, amountTable: 'detail_table', routes: [
    { name: '企画外注注文書 承認ルート（50万未満）', isDefault: true, approvers: [['企画課長', 'kikaku_kacho']], observers: [] },
    { name: '企画外注注文書 承認ルート（50万以上100万未満）', approvers: [['企画課長', 'kikaku_kacho'], ['企画生産部長', 'ks_bucho']], observers: [] },
    { name: '企画外注注文書 承認ルート（100万以上）', approvers: [['企画課長', 'kikaku_kacho'], ['企画生産部長', 'ks_bucho'], ['事業部長', 'jigyobucho']], observers: [] },
  ]},
  { code: 'T09', name: 'ｸﾞﾚｰﾃﾞｨﾝｸﾞﾊﾟﾀｰﾝ作製依頼書', category: '業務依頼', icon: 'ruler', sort: 9, isNew: true, schema: 'T09', amountTable: 'size_table', routes: [
    { name: 'グレーディング 承認ルート（50万未満）', isDefault: true, approvers: [['企画課長', 'kikaku_kacho']], observers: [] },
    { name: 'グレーディング 承認ルート（50万以上100万未満）', condition: cond(500000, 1000000, 'size_table'), approvers: [['企画課長', 'kikaku_kacho'], ['企画生産部長', 'ks_bucho']], observers: [] },
    { name: 'グレーディング 承認ルート（100万以上）', condition: cond(1000000, null, 'size_table'), approvers: [['企画課長', 'kikaku_kacho'], ['企画生産部長', 'ks_bucho'], ['事業部長', 'jigyobucho']], observers: [] },
  ]},
  { code: 'T10', name: '生地発注書', category: '業務依頼', icon: 'package', sort: 10, isNew: true, schema: 'T10', amountTable: 'fabric_items', routes: [
    { name: '生地発注書 承認ルート（1000万未満）', isDefault: true, approvers: [['企画生産部長', 'ks_bucho']], observers: [] },
    { name: '生地発注書 承認ルート（1000万以上）', condition: cond(10000000, null, 'fabric_items'), approvers: [['企画生産部長', 'ks_bucho']], observers: [['営業部長', 'eigyo_bucho'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T11', name: '付属発注書', category: '業務依頼', icon: 'package', sort: 11, isNew: true, schema: 'T11', amountTable: 'accessory_items', routes: [
    { name: '付属発注書 承認ルート（1000万未満）', isDefault: true, approvers: [['企画生産部長', 'ks_bucho']], observers: [] },
    { name: '付属発注書 承認ルート（1000万以上）', condition: cond(10000000, null, 'accessory_items'), approvers: [['企画生産部長', 'ks_bucho']], observers: [['営業部長', 'eigyo_bucho'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T12', name: '加工指図書', category: '業務依頼', icon: 'file-spreadsheet', sort: 12, isNew: true, schema: 'T12', amountTable: 'processing_items', routes: [
    { name: '加工指図書 承認ルート（1000万未満）', isDefault: true, approvers: [['営業課長', 'kacho'], ['企画生産部長', 'ks_bucho']], observers: [['生産担当', 'seisan']] },
    { name: '加工指図書 承認ルート（1000〜3000万）', condition: cond(10000000, 30000000, 'processing_items'), approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['企画生産部長', 'ks_bucho']], observers: [['生産担当', 'seisan']] },
    { name: '加工指図書 承認ルート（3000万以上）', condition: cond(30000000, null, 'processing_items'), approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho'], ['事業部長', 'jigyobucho'], ['企画生産部長', 'ks_bucho']], observers: [['生産担当', 'seisan']] },
  ]},
  { code: 'T13', name: '請求書', category: '見積', icon: 'receipt', sort: 13, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho']], observers: [] },
  ]},
  { code: 'T14', name: '採寸申請書', category: '社内申請', icon: 'ruler', sort: 14, isNew: false, routes: [
    { approvers: [['営業課長', 'kacho'], ['営業部長', 'bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T15', name: '海外出張申請書', category: '社内申請', icon: 'plane', sort: 15, isNew: false, routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho'], ['事業部長', 'jigyobucho']], observers: [] },
  ]},
  { code: 'T16', name: '海外出張報告書', category: '社内申請', icon: 'plane', sort: 16, isNew: false, routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['所属部長', 'bucho_obs'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T17', name: '国内出張報告書', category: '社内申請', icon: 'train', sort: 17, isNew: false, routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['所属部長', 'bucho_obs'], ['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T18', name: '有給休暇/半休申請書', category: '社内申請', icon: 'calendar', sort: 18, isNew: false, routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['所属部長', 'bucho_obs'], ['事業部長', 'jigyobucho']] },
  ]},
  // ---- 新規 (帳票02 #18〜#35) ----
  { code: 'T19', name: 'レンタカー運行許可申請書', category: '社内申請', icon: 'truck', sort: 19, isNew: true, schema: 'T19', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho'], ['事業部長', 'jigyobucho']], observers: [['本部人事課', 'jinji']] },
  ]},
  { code: 'T20', name: '信用調査申込書', category: '社内申請', icon: 'clipboard-check', sort: 20, isNew: true, schema: 'T20', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho']], observers: [['監査室', 'kansa']] },
  ]},
  { code: 'T21', name: '得意先仕入先口座登録変更申請書', category: '社内申請', icon: 'wallet', sort: 21, isNew: true, schema: 'T21', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho'], ['事業部長', 'jigyobucho'], ['業務部長', 'gyomu_bucho']], observers: [['監査室', 'kansa']] },
  ]},
  { code: 'T22', name: '寄託依頼書', category: '業務依頼', icon: 'package', sort: 22, isNew: true, schema: 'T22', routes: [
    { approvers: [['所属課長', 'kacho'], ['業務部長', 'gyomu_bucho']], observers: [] },
  ]},
  { code: 'T23', name: '得意先条件変更届', category: '社内申請', icon: 'edit', sort: 23, isNew: true, schema: 'T23', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho'], ['事業部長', 'jigyobucho'], ['業務部長', 'gyomu_bucho']], observers: [['監査室', 'kansa']] },
  ]},
  { code: 'T24', name: '先品振替指図書', category: '業務依頼', icon: 'package', sort: 24, isNew: true, schema: 'T24', routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['業務部長', 'gyomu_bucho']] },
  ]},
  { code: 'T25', name: '加工指図書（特需）', category: '業務依頼', icon: 'file-spreadsheet', sort: 25, isNew: true, schema: 'T25', routes: [
    { approvers: [['所属課長', 'kacho'], ['企画生産部長', 'ks_bucho']], observers: [['生産担当', 'seisan']] },
  ]},
  { code: 'T26', name: '口座外販売承認書', category: '社内申請', icon: 'wallet', sort: 26, isNew: true, schema: 'T26', routes: [
    { approvers: [['所属課長', 'kacho']], observers: [] },
  ]},
  { code: 'T27', name: '消耗品購入申請書', category: '社内申請', icon: 'shopping-cart', sort: 27, isNew: true, schema: 'T27', routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T28', name: '廃棄依頼書', category: '業務依頼', icon: 'alert-triangle', sort: 28, isNew: true, schema: 'T28', routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['業務部長', 'gyomu_bucho']] },
  ]},
  { code: 'T29', name: '限度オーバー報告書', category: '社内申請', icon: 'alert-circle', sort: 29, isNew: true, schema: 'T29', routes: [
    { approvers: [['所属課長', 'kacho'], ['営業部長', 'bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T30', name: '交際接待費申請書', category: '社内申請', icon: 'wallet', sort: 30, isNew: true, schema: 'T30', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T31', name: '品番登録フォーマット', category: '業務依頼', icon: 'file-spreadsheet', sort: 31, isNew: true, schema: 'T31', routes: [
    { approvers: [['所属課長', 'kacho']], observers: [['業務部長', 'gyomu_bucho'], ['情シス', 'joushis']] },
  ]},
  { code: 'T32', name: '案件終了報告書', category: '社内申請', icon: 'clipboard-check', sort: 32, isNew: true, schema: 'T32', routes: [
    { approvers: [['所属課長', 'kacho'], ['営業部長', 'bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T33', name: '特別費用申請書', category: '社内申請', icon: 'wallet', sort: 33, isNew: true, schema: 'T33', routes: [
    { approvers: [['所属課長', 'kacho'], ['所属部長', 'bucho']], observers: [['事業部長', 'jigyobucho']] },
  ]},
  { code: 'T34', name: 'システムデモ作成依頼書', category: '業務依頼', icon: 'maximize', sort: 34, isNew: true, schema: 'T34', routes: [
    { approvers: [['レンタル課長', 'rental_kacho']], observers: [['レンタルシステム担当', 'rental_sys']] },
  ]},
  { code: 'T35', name: 'システム改修依頼書', category: '業務依頼', icon: 'edit', sort: 35, isNew: true, schema: 'T35', routes: [
    { approvers: [['レンタル課長', 'rental_kacho']], observers: [['レンタルシステム担当', 'rental_sys']] },
  ]},
  { code: 'T36', name: 'システム本番依頼書', category: '業務依頼', icon: 'stamp', sort: 36, isNew: true, schema: 'T36', routes: [
    { approvers: [['レンタル課長', 'rental_kacho']], observers: [['レンタルシステム担当', 'rental_sys']] },
  ]},
]

// ---- SQL生成ヘルパ ----
function stepInsert(code, routeName, order, label, token) {
  const a = A[token]
  if (!a) throw new Error(`unknown token ${token}`)
  const posCol = a.pos ? posId(a.pos) : 'NULL'
  const empCol = a.email ? empId(a.email) : 'NULL'
  const routeCond = routeName ? `art.name = ${q(routeName)}` : 'true'
  return `INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, ${order}, ${q(label)}, ${q(a.type)}, ${posCol}, ${empCol}
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = ${q(code)} AND ${routeCond};`
}
function obsInsert(code, routeName, label, token) {
  const a = A[token]
  if (!a) throw new Error(`unknown token ${token}`)
  const posCol = a.pos ? posId(a.pos) : 'NULL'
  const empCol = a.email ? empId(a.email) : 'NULL'
  const routeCond = routeName ? `art.name = ${q(routeName)}` : 'true'
  return `INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, ${empCol}, ${q(a.type)}, ${posCol}, ${q(label)}, 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = ${q(code)} AND ${routeCond};`
}

// ============================================================================
// SQL 本文組み立て
// ============================================================================
const out = []
out.push(`-- ============================================================================
-- 帳票フルリフレッシュ (#1〜#35) — 条件書「ワークフロー一覧260617v1」準拠
-- 生成: scripts/gen_forms_migration.mjs
-- ============================================================================
BEGIN;
`)

// ---- 0. observers 相対役職対応（カラム追加） ----
out.push(`-- 0. 配信先(observers)を相対役職に対応させる
ALTER TABLE approval_route_observers ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS assignee_type text NOT NULL DEFAULT 'specific_employee';
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS assignee_position_id uuid REFERENCES positions(id);
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE approval_route_observers DROP CONSTRAINT IF EXISTS approval_route_observers_route_template_id_employee_id_key;
`)

// ---- 1. ダミー組織 ----
out.push(`-- 1. ダミー組織（業務部/監査室/本部人事課/情報システム課 + 担当者）
INSERT INTO departments (name, code, level, sort_order) VALUES
  ('業務部', 'GYOMU', 0, 90),
  ('監査室', 'KANSA', 0, 91),
  ('本部人事課', 'HQ-JINJI', 0, 92),
  ('情報システム課', 'JOHO-SYS', 0, 93)
ON CONFLICT (code) DO NOTHING;

INSERT INTO employees (employee_number, name, email, is_admin, is_active) VALUES
  ('EMP-D01', '業務 部長', 'gyomu-bucho@tsukamoto.co.jp', false, true),
  ('EMP-D02', '監査 室長', 'kansa@tsukamoto.co.jp', false, true),
  ('EMP-D03', '人事 課長', 'jinji@tsukamoto.co.jp', false, true),
  ('EMP-D04', '情シス 担当', 'joshis@tsukamoto.co.jp', false, true),
  ('EMP-D05', 'レンタルシステム 担当', 'rental-sys@tsukamoto.co.jp', false, true)
ON CONFLICT (email) DO NOTHING;

-- 割当（部長/課長/一般）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true FROM employees e, departments d, positions p
WHERE e.email='gyomu-bucho@tsukamoto.co.jp' AND d.code='GYOMU' AND p.code='BUCHO'
ON CONFLICT (employee_id, department_id, position_id) DO NOTHING;
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true FROM employees e, departments d, positions p
WHERE e.email='kansa@tsukamoto.co.jp' AND d.code='KANSA' AND p.code='KACHO'
ON CONFLICT (employee_id, department_id, position_id) DO NOTHING;
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true FROM employees e, departments d, positions p
WHERE e.email='jinji@tsukamoto.co.jp' AND d.code='HQ-JINJI' AND p.code='KACHO'
ON CONFLICT (employee_id, department_id, position_id) DO NOTHING;
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true FROM employees e, departments d, positions p
WHERE e.email='joshis@tsukamoto.co.jp' AND d.code='JOHO-SYS' AND p.code='IPPAN'
ON CONFLICT (employee_id, department_id, position_id) DO NOTHING;
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true FROM employees e, departments d, positions p
WHERE e.email='rental-sys@tsukamoto.co.jp' AND d.code='USP-SALES-RT' AND p.code='IPPAN'
ON CONFLICT (employee_id, department_id, position_id) DO NOTHING;
`)

// ---- 2. フォームごとの処理 ----
for (const f of forms) {
  out.push(`\n-- ===== ${f.code} ${f.name} =====`)
  if (f.isNew) {
    // document_type
    out.push(`INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES (${q(f.code)}, ${q(f.name)}, ${q(f.category)}, ${q(f.icon)}, ${f.sort}, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;`)
    // form_template
    const schema = S[f.schema]
    if (!schema) throw new Error(`missing schema ${f.schema} for ${f.code}`)
    out.push(`INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, ${jsonb(schema)} FROM document_types dt WHERE dt.code = ${q(f.code)}
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);`)
    // route templates
    for (const r of f.routes) {
      const rname = r.name || `${f.name} 承認ルート`
      const isDefault = r.isDefault !== false && f.routes.length === 1 ? true : !!r.isDefault
      const condSql = r.condition ? jsonb(r.condition) : 'NULL'
      out.push(`INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, ${q(rname)}, ${isDefault}, true, ${condSql} FROM document_types dt WHERE dt.code = ${q(f.code)}
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = ${q(rname)});`)
    }
  } else {
    // 既存: 再有効化＋メタ更新
    out.push(`UPDATE document_types SET is_active=true, sort_order=${f.sort}, category=${q(f.category)}, icon=${q(f.icon)}, name=${q(f.name)} WHERE code=${q(f.code)};`)
  }

  // 冪等化: 当該書類の全ルートのステップ/配信先を一旦クリア（テンプレートは温存）
  out.push(`DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code=${q(f.code)});`)
  out.push(`DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code=${q(f.code)});`)

  // steps + observers（新規/既存共通。既存単一ルートは routeName=null で対象特定）
  const multi = f.routes.length > 1
  for (const r of f.routes) {
    const rname = f.isNew ? (r.name || `${f.name} 承認ルート`) : (multi ? r.name : null)
    r.approvers.forEach(([label, token], i) => out.push(stepInsert(f.code, rname, i + 1, label, token)))
    r.observers.forEach(([label, token]) => out.push(obsInsert(f.code, rname, label, token)))
  }
}

// ---- 3. total_steps はエンジンが解決時に決定するため未設定でOK ----
out.push('\nCOMMIT;')

writeFileSync(OUT, out.join('\n') + '\n', 'utf8')
console.log('written:', OUT)
console.log('forms:', forms.length, ' new:', forms.filter(f => f.isNew).length)
