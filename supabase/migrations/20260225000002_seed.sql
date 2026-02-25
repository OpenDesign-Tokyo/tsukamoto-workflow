-- ============================================
-- 役職マスタ
-- ============================================
INSERT INTO positions (name, code, rank) VALUES
  ('事業部長', 'JIGYOBUCHO', 100),
  ('副事業部長', 'FUKU_JIGYOBUCHO', 90),
  ('部長', 'BUCHO', 80),
  ('副部長', 'FUKU_BUCHO', 70),
  ('課長', 'KACHO', 60),
  ('課長代理', 'KACHO_DAIRI', 55),
  ('係長', 'KAKARICHO', 50),
  ('主任', 'SHUNIN', 40),
  ('一般', 'IPPAN', 10);

-- ============================================
-- 部署マスタ（ユニフォーム事業部の組織構造）
-- ============================================

-- 事業部（Level 0）
INSERT INTO departments (name, code, level, sort_order) VALUES
  ('ユニフォーム事業部', 'UNI', 0, 1);

-- 部（Level 1）
INSERT INTO departments (name, code, parent_id, level, sort_order) VALUES
  ('営業部', 'UNI-SALES', (SELECT id FROM departments WHERE code = 'UNI'), 1, 1),
  ('企画部', 'UNI-PLAN', (SELECT id FROM departments WHERE code = 'UNI'), 1, 2),
  ('業務管理部', 'UNI-OPS', (SELECT id FROM departments WHERE code = 'UNI'), 1, 3),
  ('品質管理部', 'UNI-QC', (SELECT id FROM departments WHERE code = 'UNI'), 1, 4);

-- 課（Level 2）
INSERT INTO departments (name, code, parent_id, level, sort_order) VALUES
  ('営業1課', 'UNI-SALES-1', (SELECT id FROM departments WHERE code = 'UNI-SALES'), 2, 1),
  ('営業2課', 'UNI-SALES-2', (SELECT id FROM departments WHERE code = 'UNI-SALES'), 2, 2),
  ('営業3課', 'UNI-SALES-3', (SELECT id FROM departments WHERE code = 'UNI-SALES'), 2, 3),
  ('企画1課', 'UNI-PLAN-1', (SELECT id FROM departments WHERE code = 'UNI-PLAN'), 2, 1),
  ('企画2課', 'UNI-PLAN-2', (SELECT id FROM departments WHERE code = 'UNI-PLAN'), 2, 2),
  ('業務課', 'UNI-OPS-1', (SELECT id FROM departments WHERE code = 'UNI-OPS'), 2, 1),
  ('物流課', 'UNI-OPS-2', (SELECT id FROM departments WHERE code = 'UNI-OPS'), 2, 2);

-- ============================================
-- デモ用従業員（Supabase Authにユーザー作成も必要）
-- ============================================
INSERT INTO employees (name, name_kana, email, employee_number, is_admin) VALUES
  ('田中太郎', 'タナカタロウ', 'tanaka@tsukamoto-demo.com', 'EMP001', false),
  ('佐藤花子', 'サトウハナコ', 'sato@tsukamoto-demo.com', 'EMP002', false),
  ('鈴木一郎', 'スズキイチロウ', 'suzuki@tsukamoto-demo.com', 'EMP003', false),
  ('高橋部長', 'タカハシブチョウ', 'takahashi@tsukamoto-demo.com', 'EMP004', false),
  ('山本事業部長', 'ヤマモトジギョウブチョウ', 'yamamoto@tsukamoto-demo.com', 'EMP005', true),
  ('管理者', 'カンリシャ', 'admin@tsukamoto-demo.com', 'EMP000', true);

-- 所属アサイン
-- 田中太郎: 営業1課 一般（申請者役）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary)
SELECT e.id, d.id, p.id, true
FROM employees e, departments d, positions p
WHERE e.email = 'tanaka@tsukamoto-demo.com' AND d.code = 'UNI-SALES-1' AND p.code = 'IPPAN';

-- 佐藤花子: 営業1課 課長（第1承認者）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary)
SELECT e.id, d.id, p.id, true
FROM employees e, departments d, positions p
WHERE e.email = 'sato@tsukamoto-demo.com' AND d.code = 'UNI-SALES-1' AND p.code = 'KACHO';

-- 鈴木一郎: 営業1課 係長
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary)
SELECT e.id, d.id, p.id, true
FROM employees e, departments d, positions p
WHERE e.email = 'suzuki@tsukamoto-demo.com' AND d.code = 'UNI-SALES-1' AND p.code = 'KAKARICHO';

-- 高橋部長: 営業部 部長（第2承認者）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary)
SELECT e.id, d.id, p.id, true
FROM employees e, departments d, positions p
WHERE e.email = 'takahashi@tsukamoto-demo.com' AND d.code = 'UNI-SALES' AND p.code = 'BUCHO';

-- 山本事業部長: ユニフォーム事業部 事業部長（第3承認者）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary)
SELECT e.id, d.id, p.id, true
FROM employees e, departments d, positions p
WHERE e.email = 'yamamoto@tsukamoto-demo.com' AND d.code = 'UNI' AND p.code = 'JIGYOBUCHO';

-- ============================================
-- 書類種別マスタ
-- ============================================
INSERT INTO document_types (code, name, category, description, icon, sort_order) VALUES
  ('T01', '採寸申請書', '社内申請', '顧客先での採寸実施の申請', 'ruler', 1),
  ('T02', '海外出張事前申請', '社内申請', '海外出張の事前承認申請', 'plane', 2),
  ('T03', '海外出張報告書', '社内申請', '海外出張完了後の報告', 'file-text', 3),
  ('T04', '企画依頼書', '社内申請', '新規企画の依頼', 'lightbulb', 4),
  ('T05', 'クレーム報告書（様式A）', '社内申請', 'クレーム発生時の正式報告', 'alert-triangle', 5),
  ('T06', 'クレーム報告書（簡易版）', '社内申請', '軽微なクレームの簡易報告', 'alert-circle', 6),
  ('T07', '仕様修正依頼書', '業務依頼', '製品仕様の修正依頼', 'edit', 7),
  ('T08', '企画外注注文書', '業務依頼', '外注先への発注', 'shopping-cart', 8),
  ('T09', 'グレーディング依頼書', '業務依頼', 'サイズ展開の依頼', 'maximize', 9),
  ('T10', '生地手配予定表', '業務依頼', '生地の手配スケジュール', 'calendar', 10),
  ('T11a', '商品納入証明書（三越伊勢丹）', '出荷証明書', '三越伊勢丹向け納入証明', 'truck', 11),
  ('T11b', '商品納入証明書（そごう西武）', '出荷証明書', 'そごう西武向け納入証明', 'truck', 12),
  ('T11c', '商品納入証明書（高島屋）', '出荷証明書', '高島屋向け納入証明', 'truck', 13),
  ('T11d', '商品納入証明書（大丸松坂屋）', '出荷証明書', '大丸松坂屋向け納入証明', 'truck', 14),
  ('T12', '商品納入証明書（JR西日本）', '出荷証明書', 'JR西日本向け納入証明', 'truck', 15),
  ('T13', '請求書', '請求', '請求書の発行・承認', 'receipt', 16),
  ('T14', '見積書', '請求', '見積書の発行・承認', 'file-spreadsheet', 17);

-- ============================================
-- デモ用フォームテンプレート（T01: 採寸申請書）
-- ============================================
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "application_date", "type": "date", "label": "申請日", "required": true, "defaultValue": "today"},
    {"id": "client_name", "type": "text", "label": "顧客名", "required": true, "placeholder": "株式会社〇〇"},
    {"id": "client_contact", "type": "text", "label": "顧客担当者", "required": false},
    {"id": "visit_date", "type": "date", "label": "訪問予定日", "required": true},
    {"id": "visit_location", "type": "text", "label": "訪問先住所", "required": true},
    {"id": "target_count", "type": "number", "label": "採寸予定人数", "required": true},
    {"id": "items", "type": "table", "label": "採寸品目", "columns": [
      {"id": "product_category", "type": "text", "label": "品目カテゴリ", "width": "25%"},
      {"id": "product_name", "type": "text", "label": "品名", "width": "30%"},
      {"id": "quantity", "type": "number", "label": "予定数量", "width": "15%"},
      {"id": "unit_price", "type": "currency", "label": "単価", "width": "15%"},
      {"id": "subtotal", "type": "formula", "label": "小計", "formula": "quantity * unit_price", "width": "15%"}
    ], "minRows": 1, "maxRows": 30, "allowExcelPaste": true},
    {"id": "total_amount", "type": "formula", "label": "合計金額（税抜）", "formula": "SUM(items.subtotal)"},
    {"id": "purpose", "type": "textarea", "label": "採寸目的・備考", "required": false, "rows": 4}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "基本情報", "fields": ["application_date", "client_name", "client_contact"]},
      {"title": "訪問情報", "fields": ["visit_date", "visit_location", "target_count"]},
      {"title": "採寸品目", "fields": ["items", "total_amount"]},
      {"title": "備考", "fields": ["purpose"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T01';

-- ============================================
-- デモ用フォームテンプレート（T05: クレーム報告書）
-- ============================================
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{
  "version": 1,
  "fields": [
    {"id": "report_date", "type": "date", "label": "報告日", "required": true, "defaultValue": "today"},
    {"id": "occurrence_date", "type": "date", "label": "発生日", "required": true},
    {"id": "client_name", "type": "text", "label": "顧客名", "required": true},
    {"id": "product_name", "type": "text", "label": "対象商品", "required": true},
    {"id": "order_number", "type": "text", "label": "受注番号", "required": false},
    {"id": "severity", "type": "select", "label": "重要度", "required": true, "options": [
      {"value": "high", "label": "重大"},
      {"value": "medium", "label": "中程度"},
      {"value": "low", "label": "軽微"}
    ]},
    {"id": "category", "type": "select", "label": "クレーム分類", "required": true, "options": [
      {"value": "quality", "label": "品質不良"},
      {"value": "delivery", "label": "納期遅延"},
      {"value": "quantity", "label": "数量相違"},
      {"value": "spec", "label": "仕様相違"},
      {"value": "other", "label": "その他"}
    ]},
    {"id": "description", "type": "textarea", "label": "クレーム内容", "required": true, "rows": 6},
    {"id": "cause", "type": "textarea", "label": "原因分析", "required": true, "rows": 4},
    {"id": "corrective_action", "type": "textarea", "label": "対応・是正措置", "required": true, "rows": 4},
    {"id": "cost_impact", "type": "currency", "label": "損害見込額", "required": false}
  ],
  "layout": {
    "type": "sections",
    "sections": [
      {"title": "基本情報", "fields": ["report_date", "occurrence_date", "client_name", "product_name", "order_number"]},
      {"title": "クレーム分類", "fields": ["severity", "category"]},
      {"title": "詳細", "fields": ["description", "cause", "corrective_action"]},
      {"title": "影響", "fields": ["cost_impact"]}
    ]
  }
}'::jsonb
FROM document_types dt WHERE dt.code = 'T05';

-- ============================================
-- デモ用承認ルート（T01: 課長→部長→事業部長 3段階）
-- ============================================
INSERT INTO approval_route_templates (document_type_id, name, is_default)
SELECT dt.id, '標準承認ルート（3段階）', true
FROM document_types dt WHERE dt.code = 'T01';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 1, '課長承認', 'position_in_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T01' AND p.code = 'KACHO';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 2, '部長承認', 'position_in_parent_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T01' AND p.code = 'BUCHO';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 3, '事業部長承認', 'position_in_parent_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T01' AND p.code = 'JIGYOBUCHO';

-- T05にも同じルートを設定
INSERT INTO approval_route_templates (document_type_id, name, is_default)
SELECT dt.id, '標準承認ルート（3段階）', true
FROM document_types dt WHERE dt.code = 'T05';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 1, '課長承認', 'position_in_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T05' AND p.code = 'KACHO';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 2, '部長承認', 'position_in_parent_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T05' AND p.code = 'BUCHO';

INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id)
SELECT art.id, 3, '事業部長承認', 'position_in_parent_department', p.id
FROM approval_route_templates art
JOIN document_types dt ON art.document_type_id = dt.id
CROSS JOIN positions p
WHERE dt.code = 'T05' AND p.code = 'JIGYOBUCHO';
