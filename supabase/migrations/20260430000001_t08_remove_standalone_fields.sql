-- T08 企画外注向け注文書: 独立の数量・単価・金額フィールドを削除し、明細テーブルのみで管理する。
-- 発注条件セクションは発注日・納期・品名仕様のみ残す。

BEGIN;

UPDATE form_templates
SET schema = jsonb_build_object(
  'version', '1.0',
  'fields', '[
    {"id": "vendor_name", "type": "text", "label": "外注先名", "required": true},
    {"id": "project_name", "type": "text", "label": "案件名", "required": true},
    {"id": "order_date", "type": "date", "label": "発注日", "required": true},
    {"id": "delivery_date", "type": "date", "label": "納期", "required": true},
    {"id": "item_spec", "type": "text", "label": "品名・仕様", "required": true},
    {"id": "detail_table", "type": "table", "label": "明細テーブル", "columns": [
      {"id": "item_name", "type": "text", "label": "品名", "width": "20%"},
      {"id": "spec", "type": "text", "label": "仕様", "width": "25%"},
      {"id": "qty", "type": "number", "label": "数量", "width": "10%"},
      {"id": "price", "type": "currency", "label": "単価", "width": "15%"},
      {"id": "line_amount", "type": "formula", "label": "金額", "formula": "qty * price", "width": "15%"}
    ], "minRows": 1, "maxRows": 20, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額", "formula": "SUM(detail_table.line_amount)"},
    {"id": "remarks", "type": "textarea", "label": "備考", "required": false, "rows": 3},
    {"id": "delivery_location", "type": "text", "label": "納品場所", "required": false}
  ]'::jsonb,
  'layout', '{
    "type": "sections",
    "sections": [
      {"title": "発注先情報", "fields": ["vendor_name", "project_name"]},
      {"title": "発注条件", "fields": ["order_date", "delivery_date", "item_spec"]},
      {"title": "明細", "fields": ["detail_table", "total_amount"]},
      {"title": "備考・納品", "fields": ["remarks", "delivery_location"]}
    ]
  }'::jsonb
)
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08')
  AND is_current = true;

COMMIT;
