-- ─────────────────────────────────────────────────────────────────────────────
-- T08 企画外注向け注文書: vendor_select 投入 (Phase 1.3)
-- ─────────────────────────────────────────────────────────────────────────────
-- 変更点:
--   - 既存の `vendor_name`（手入力）を `vendor_id`（vendor_select）に置換
--   - vendor_id 選択時に vendor_name / vendor_contact_person / vendor_address /
--     vendor_payment_terms が自動展開される（vendorAutoFill）
--   - vendor_id は「外注先」「仕入先」カテゴリのみ表示
--   - 既存の form_data に保存されている `vendor_name` 文字列は手入力フォール
--     バックとして残るため、過去申請の表示は壊れない
--
-- 適用前提:
--   supabase/migrations/20260513000002_vendors.sql が適用済みであること。
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE form_templates
SET schema = jsonb_build_object(
  'version', '3.0',
  'fields', '[
    {
      "id": "vendor_id",
      "type": "vendor_select",
      "label": "外注先（マスタから選択）",
      "required": true,
      "vendorCategories": ["外注先", "仕入先"],
      "vendorAutoFill": [
        {"fieldId": "vendor_name",            "vendorKey": "name"},
        {"fieldId": "vendor_contact_person",  "vendorKey": "contact_person"},
        {"fieldId": "vendor_address",         "vendorKey": "address"},
        {"fieldId": "vendor_payment_terms",   "vendorKey": "payment_terms"}
      ]
    },
    {"id": "vendor_name",           "type": "text", "label": "外注先名",   "required": false, "placeholder": "取引先を選択すると自動入力されます"},
    {"id": "vendor_contact_person", "type": "text", "label": "担当者",     "required": false, "placeholder": "取引先を選択すると自動入力されます"},
    {"id": "vendor_address",        "type": "text", "label": "住所",       "required": false, "placeholder": "取引先を選択すると自動入力されます"},
    {"id": "vendor_payment_terms",  "type": "text", "label": "支払サイト", "required": false, "placeholder": "取引先を選択すると自動入力されます"},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "order_date",   "type": "date", "label": "職出し日", "required": true, "defaultValue": "today"},
    {"id": "delivery_date","type": "date", "label": "納期",     "required": true},
    {"id": "detail_table", "type": "table", "label": "明細", "columns": [
      {"id": "item_name",   "type": "text",     "label": "品名", "width": "25%"},
      {"id": "qty",         "type": "number",   "label": "数量", "width": "10%"},
      {"id": "price",       "type": "currency", "label": "単価", "width": "15%"},
      {"id": "line_amount", "type": "formula",  "label": "金額", "formula": "qty * price", "width": "15%"},
      {"id": "content",     "type": "text",     "label": "内容", "width": "25%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true,
    "templateConfig": {
      "title": "企画外注向け注文書",
      "documentTitle": "注文書",
      "companyName": "ツカモトコーポレーション",
      "companyLogoPlaceholder": true,
      "approvalSeals": 3,
      "metaBlock": [
        {"label": "申請番号"},
        {"label": "申請日"},
        {"label": "申請者"}
      ],
      "vendorBlock": true,
      "headerFields": [
        {"label": "職出し日"},
        {"label": "納期"}
      ],
      "footerFields": [
        {"label": "成果物"},
        {"label": "納入先"},
        {"label": "支払方法"}
      ],
      "dataRows": 15,
      "taxNote": "(税別)"
    }},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(detail_table.line_amount)"},
    {"id": "deliverable",         "type": "text", "label": "成果物",   "required": false},
    {"id": "delivery_destination","type": "text", "label": "納入先",   "required": false},
    {"id": "payment_method",      "type": "text", "label": "支払方法", "required": false}
  ]'::jsonb,
  'layout', '{
    "type": "sections",
    "sections": [
      {"title": "発注先情報", "fields": ["vendor_id", "vendor_name", "vendor_contact_person", "vendor_address", "vendor_payment_terms", "project_name"]},
      {"title": "発注条件",   "fields": ["order_date", "delivery_date"]},
      {"title": "明細",       "fields": ["detail_table", "total_amount"]},
      {"title": "その他",     "fields": ["deliverable", "delivery_destination", "payment_method"]}
    ]
  }'::jsonb
)
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08')
  AND is_current = true;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- TODO (Phase 1.3 残):
--   T14 (仕入計上依頼書) / T18 (支払依頼書) の現行スキーマは「見積書」「経費
--   精算」になっており、仕様書の意図と乖離している。実運用フローを森口さん
--   とすり合わせた上で、同じ vendor_select パターンを適用する別マイグレー
--   ションを追加すること。
-- ─────────────────────────────────────────────────────────────────────────────
