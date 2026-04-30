-- T08 企画外注向け注文書: テンプレート項目を更新
-- 変更点:
--   - order_date ラベルを「職出し日」に変更
--   - テーブル列: spec(仕様)を削除し、品名/数量/単価/金額/内容の構成に変更
--   - item_spec（独立フィールド）を削除
--   - 成果物・納入先・支払方法フィールドを追加
--   - templateConfig を追加（Excel テンプレート生成用）
--   - remarks を削除

BEGIN;

UPDATE form_templates
SET schema = jsonb_build_object(
  'version', '2.0',
  'fields', '[
    {"id": "vendor_name", "type": "text", "label": "外注先名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "order_date", "type": "date", "label": "職出し日", "required": true, "defaultValue": "today"},
    {"id": "delivery_date", "type": "date", "label": "納期", "required": true},
    {"id": "detail_table", "type": "table", "label": "明細", "columns": [
      {"id": "item_name", "type": "text", "label": "品名", "width": "25%"},
      {"id": "qty", "type": "number", "label": "数量", "width": "10%"},
      {"id": "price", "type": "currency", "label": "単価", "width": "15%"},
      {"id": "line_amount", "type": "formula", "label": "金額", "formula": "qty * price", "width": "15%"},
      {"id": "content", "type": "text", "label": "内容", "width": "25%"}
    ], "minRows": 1, "maxRows": 15, "allowExcelPaste": true,
    "templateConfig": {
      "title": "企画外注向け注文書",
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
    {"id": "deliverable", "type": "text", "label": "成果物", "required": false},
    {"id": "delivery_destination", "type": "text", "label": "納入先", "required": false},
    {"id": "payment_method", "type": "text", "label": "支払方法", "required": false}
  ]'::jsonb,
  'layout', '{
    "type": "sections",
    "sections": [
      {"title": "発注先情報", "fields": ["vendor_name", "project_name"]},
      {"title": "発注条件", "fields": ["order_date", "delivery_date"]},
      {"title": "明細", "fields": ["detail_table", "total_amount"]},
      {"title": "その他", "fields": ["deliverable", "delivery_destination", "payment_method"]}
    ]
  }'::jsonb
)
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08')
  AND is_current = true;

COMMIT;
