-- 企画外注向け注文書を1つに統合し、金額ベースで承認ルートを自動選択する。
-- T08a(50万未満), T08b(50万以上100万未満), T08c(100万以上) → T08(企画外注向け注文書)

BEGIN;

-- 1. 統合された書類種別 T08 を作成
INSERT INTO document_types (code, name, category, icon, sort_order, description)
VALUES ('T08', '企画外注向け注文書', '業務依頼', 'ShoppingCart', 10,
        '金額に応じて承認ルートが自動選択されます');

-- 2. T08用フォームテンプレートを作成（T08aと同じスキーマ）
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT
  (SELECT id FROM document_types WHERE code = 'T08'),
  1, true, ft.schema
FROM form_templates ft
JOIN document_types dt ON ft.document_type_id = dt.id
WHERE dt.code = 'T08a' AND ft.is_current = true;

-- 3. 既存の3ルートテンプレートをT08に紐付け変更
-- T08a: 50万未満ルート → デフォルト（条件なし）
UPDATE approval_route_templates
SET document_type_id = (SELECT id FROM document_types WHERE code = 'T08'),
    name = '企画外注注文書 承認ルート（50万未満）',
    is_default = true,
    condition = NULL
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08a');

-- T08b: 50万以上100万未満ルート → 条件付き
UPDATE approval_route_templates
SET document_type_id = (SELECT id FROM document_types WHERE code = 'T08'),
    name = '企画外注注文書 承認ルート（50万以上100万未満）',
    is_default = false,
    condition = '{"amount_field":"total_amount","compute_from":{"table":"detail_table","sum_column":"line_amount"},"min":500000,"max":1000000}'::jsonb
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08b');

-- T08c: 100万以上ルート → 条件付き
UPDATE approval_route_templates
SET document_type_id = (SELECT id FROM document_types WHERE code = 'T08'),
    name = '企画外注注文書 承認ルート（100万以上）',
    is_default = false,
    condition = '{"amount_field":"total_amount","compute_from":{"table":"detail_table","sum_column":"line_amount"},"min":1000000}'::jsonb
WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08c');

-- 4. 既存の申請をT08に移行
UPDATE applications
SET document_type_id = (SELECT id FROM document_types WHERE code = 'T08'),
    form_template_id = (SELECT id FROM form_templates
                        WHERE document_type_id = (SELECT id FROM document_types WHERE code = 'T08')
                        AND is_current = true)
WHERE document_type_id IN (
  SELECT id FROM document_types WHERE code IN ('T08a', 'T08b', 'T08c')
);

-- 5. 旧書類種別を非表示
UPDATE document_types
SET is_active = false, updated_at = now()
WHERE code IN ('T08a', 'T08b', 'T08c');

COMMIT;
