/**
 * 取引先マスタの xlsx テンプレートを生成する。
 *
 * 利用シーン:
 *   - 管理画面の「テンプレートダウンロード」ボタンから配布
 *   - ユーザーが Excel で記入 → 「インポート」でアップロード
 *
 * 設計:
 *   - 日本語ヘッダー（リテラシー低でも読める）
 *   - 必須列は `*` マーク
 *   - サンプル行 3 件入り（消して上書き or 下に追記）
 *   - 別シート「入力ガイド」で列の意味と書式を解説
 */

const COLORS = {
  headerBg:     'FF2B579A', // 濃紺
  headerFont:   'FFFFFFFF', // 白
  requiredBg:   'FFFFE4E1', // 薄ピンク（必須セル）
  sampleBg:     'FFFFFCEC', // 薄イエロー（サンプル）
  border:       'FFB0B0B0',
} as const

const THIN_BORDER: import('exceljs').Border = { style: 'thin', color: { argb: COLORS.border } }
const ALL_BORDERS: Partial<import('exceljs').Borders> = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
}

interface ColumnDef {
  label: string         // 表示ラベル（日本語）
  key: string           // 内部キー（英語）
  required?: boolean
  width: number
  description: string   // ガイドシート用の説明
  example: string       // ガイドシートのサンプル値
}

export const VENDOR_TEMPLATE_COLUMNS: ColumnDef[] = [
  { label: '取引先コード', key: 'code',           required: true,  width: 14, description: '社内で振る一意のコード。半角英数字+ハイフン推奨（例: V-0001）',                 example: 'V-0001' },
  { label: '社名',         key: 'name',           required: true,  width: 28, description: '正式社名。「株式会社」「有限会社」も含めて入力',                                    example: '株式会社サンプル繊維' },
  { label: 'フリガナ',     key: 'name_kana',                       width: 18, description: '検索用のカナ表記。「カブシキガイシャ」は省略可',                                    example: 'サンプルセンイ' },
  { label: '略称',         key: 'short_name',                      width: 14, description: '一覧表示に使う短い社名',                                                            example: 'サンプル繊維' },
  { label: '区分',         key: 'category',                        width: 10, description: '仕入先 / 外注先 / その他 のいずれかを入力',                                          example: '仕入先' },
  { label: '住所',         key: 'address',                         width: 32, description: '本社住所',                                                                            example: '東京都品川区東品川1-1-1' },
  { label: '担当者',       key: 'contact_person',                  width: 14, description: '主担当者の氏名',                                                                      example: '山田太郎' },
  { label: '担当メール',   key: 'contact_email',                   width: 26, description: 'メールアドレス。形式が不正だとインポート時にエラー',                                example: 'yamada@sample-textile.co.jp' },
  { label: '電話番号',     key: 'contact_phone',                   width: 16, description: '代表電話 or 担当者直通',                                                              example: '03-1111-1111' },
  { label: '支払サイト',   key: 'payment_terms',                   width: 22, description: '支払条件をそのまま記載',                                                              example: '月末締め翌月末払い' },
  { label: '与信枠（円）', key: 'credit_limit',                    width: 14, description: '与信枠の金額（円、整数）。カンマ区切りも可。空欄＝制限なし',                        example: '5,000,000' },
  { label: '有効',         key: 'is_active',                       width: 8,  description: '「有効」または「無効」。空欄は「有効」扱い',                                          example: '有効' },
]

const SAMPLE_ROWS = [
  { code: 'V-0001', name: '株式会社サンプル繊維', name_kana: 'サンプルセンイ', short_name: 'サンプル繊維', category: '仕入先', address: '東京都品川区東品川1-1-1', contact_person: '山田太郎', contact_email: 'yamada@sample-textile.co.jp', contact_phone: '03-1111-1111', payment_terms: '月末締め翌月末払い',   credit_limit: 5000000, is_active: '有効' },
  { code: 'V-0002', name: '株式会社ベスト染色',   name_kana: 'ベストセンショク', short_name: 'ベスト染色',   category: '外注先', address: '大阪府大阪市中央区1-2-3', contact_person: '鈴木花子', contact_email: 'suzuki@best-dye.co.jp',       contact_phone: '06-2222-2222', payment_terms: '月末締め翌々月末払い', credit_limit: 3000000, is_active: '有効' },
  { code: 'V-0003', name: '富士縫製株式会社',     name_kana: 'フジホウセイ',     short_name: '富士縫製',     category: '外注先', address: '静岡県富士市3-4-5',         contact_person: '田中一郎', contact_email: 'tanaka@fuji-sewing.co.jp',    contact_phone: '0545-33-3333', payment_terms: '月末締め翌月末払い',   credit_limit: 2000000, is_active: '有効' },
]

export async function generateVendorTemplate(): Promise<ArrayBuffer> {
  const ExcelJS = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ツカモトワークフロー'

  /* ── Sheet 1: 取引先マスタ ─────────────────────────────────────── */
  const ws = wb.addWorksheet('取引先マスタ', {
    properties: { defaultColWidth: 12 },
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  ws.columns = VENDOR_TEMPLATE_COLUMNS.map(c => ({ width: c.width }))

  // Header row
  const hdr = ws.getRow(1)
  hdr.height = 28
  VENDOR_TEMPLATE_COLUMNS.forEach((col, idx) => {
    const cell = hdr.getCell(idx + 1)
    cell.value = col.required ? `${col.label} *` : col.label
    cell.font = { bold: true, color: { argb: COLORS.headerFont }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = ALL_BORDERS
  })

  // Sample rows (rows 2–4)
  SAMPLE_ROWS.forEach((sample, sIdx) => {
    const row = ws.getRow(2 + sIdx)
    row.height = 22
    VENDOR_TEMPLATE_COLUMNS.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1)
      const val = (sample as Record<string, unknown>)[col.key]
      if (val != null) cell.value = val as string | number
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sampleBg } }
      cell.border = ALL_BORDERS
      cell.alignment = { vertical: 'middle' }
      if (col.key === 'credit_limit') {
        cell.numFmt = '#,##0'
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      }
    })
  })

  // Add ~20 empty rows so the user can type directly
  for (let r = 5; r < 25; r++) {
    const row = ws.getRow(r)
    VENDOR_TEMPLATE_COLUMNS.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1)
      cell.border = ALL_BORDERS
      if (col.key === 'credit_limit') cell.numFmt = '#,##0'
    })
  }

  /* ── Sheet 2: 入力ガイド ──────────────────────────────────────── */
  const guide = wb.addWorksheet('入力ガイド')
  guide.columns = [{ width: 18 }, { width: 10 }, { width: 55 }, { width: 30 }]

  const guideHdr = guide.getRow(1)
  guideHdr.height = 24
  ;['列名', '必須/任意', '説明', '記入例'].forEach((label, idx) => {
    const c = guideHdr.getCell(idx + 1)
    c.value = label
    c.font = { bold: true, color: { argb: COLORS.headerFont } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = ALL_BORDERS
  })

  VENDOR_TEMPLATE_COLUMNS.forEach((col, idx) => {
    const row = guide.getRow(idx + 2)
    row.height = 28
    row.getCell(1).value = col.label
    row.getCell(2).value = col.required ? '必須' : '任意'
    row.getCell(3).value = col.description
    row.getCell(4).value = col.example
    for (let c = 1; c <= 4; c++) {
      row.getCell(c).border = ALL_BORDERS
      row.getCell(c).alignment = { vertical: 'middle', wrapText: true }
    }
    if (col.required) {
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.requiredBg } }
      row.getCell(2).font = { bold: true, color: { argb: 'FFB22222' } }
    }
  })

  // Notes at the bottom of the guide sheet
  const notesStart = VENDOR_TEMPLATE_COLUMNS.length + 3
  guide.getCell(notesStart, 1).value = '【インポート時の注意】'
  guide.getCell(notesStart, 1).font = { bold: true, size: 12 }
  ;[
    '・「取引先コード」が既存マスタに存在する場合は上書き更新されます',
    '・サンプル行（黄色）は不要な場合は削除してください',
    '・空のセルは未設定として保存されます',
    '・「与信枠」は数値 (5,000,000) でもカンマなし (5000000) でも可',
    '・「有効」列は「有効」「無効」、または英語で true/false でも可',
  ].forEach((text, i) => {
    guide.getCell(notesStart + 1 + i, 1).value = text
    guide.mergeCells(notesStart + 1 + i, 1, notesStart + 1 + i, 4)
  })

  return await wb.xlsx.writeBuffer() as ArrayBuffer
}
