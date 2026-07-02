-- ============================================================================
-- 帳票フルリフレッシュ (#1〜#35) — 条件書「ワークフロー一覧260617v1」準拠
-- 生成: scripts/gen_forms_migration.mjs
-- ============================================================================
BEGIN;

-- 0. 配信先(observers)を相対役職に対応させる
ALTER TABLE approval_route_observers ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS assignee_type text NOT NULL DEFAULT 'specific_employee';
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS assignee_position_id uuid REFERENCES positions(id);
ALTER TABLE approval_route_observers ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE approval_route_observers DROP CONSTRAINT IF EXISTS approval_route_observers_route_template_id_employee_id_key;

-- 1. ダミー組織（業務部/監査室/本部人事課/情報システム課 + 担当者）
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


-- ===== T01 デザイン企画依頼書 =====
UPDATE document_types SET is_active=true, sort_order=1, category='業務依頼', icon='lightbulb', name='デザイン企画依頼書' WHERE code='T01';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T01');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T01');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 4, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp'), 'specific_employee', NULL, '企画MD', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T01' AND true;

-- ===== T02 見積書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T02', '見積書', '見積', 'file-text', 2, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"customer_name","type":"text","label":"顧客名","required":true},{"id":"estimate_items","type":"table","label":"見積明細","columns":[{"id":"item_name","type":"text","label":"品名","width":"30%"},{"id":"spec","type":"text","label":"仕様","width":"20%"},{"id":"quantity","type":"number","label":"数量","width":"10%"},{"id":"unit_price","type":"currency","label":"単価","width":"15%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"15%"}],"minRows":1,"maxRows":50},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(estimate_items.subtotal)"},{"id":"valid_until","type":"date","label":"有効期限","required":true},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"基本情報","fields":["project_name","customer_name"]},{"title":"見積明細","fields":["estimate_items","total_amount"]},{"title":"条件","fields":["valid_until","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T02'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '見積書 承認ルート（1000万未満）', true, true, NULL FROM document_types dt WHERE dt.code = 'T02'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '見積書 承認ルート（1000万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '見積書 承認ルート（1000〜3000万）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"estimate_items","sum_column":"subtotal"},"min":10000000,"max":30000000}'::jsonb FROM document_types dt WHERE dt.code = 'T02'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '見積書 承認ルート（1000〜3000万）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '見積書 承認ルート（3000万以上）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"estimate_items","sum_column":"subtotal"},"min":30000000}'::jsonb FROM document_types dt WHERE dt.code = 'T02'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '見積書 承認ルート（3000万以上）');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T02');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T02');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（1000万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（3000万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（3000万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T02' AND art.name = '見積書 承認ルート（3000万以上）';

-- ===== T03 生地手配依頼書 =====
UPDATE document_types SET is_active=true, sort_order=3, category='業務依頼', icon='package', name='生地手配依頼書' WHERE code='T03';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T03');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T03');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T03' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T03' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T03' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T03' AND true;

-- ===== T04 仕様変更依頼書 =====
UPDATE document_types SET is_active=true, sort_order=4, category='業務依頼', icon='edit', name='仕様変更依頼書' WHERE code='T04';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T04');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T04');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '生産担当', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 4, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'h-omori@tsukamoto.co.jp'), 'specific_employee', NULL, '担当パタンナー', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04' AND true;

-- ===== T04b 仕様修正依頼書 =====
UPDATE document_types SET is_active=true, sort_order=5, category='業務依頼', icon='edit', name='仕様修正依頼書' WHERE code='T04b';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T04b');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T04b');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04b' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04b' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'h-omori@tsukamoto.co.jp'), 'specific_employee', NULL, '担当パタンナー', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T04b' AND true;

-- ===== T05 コンペ結果報告書 =====
UPDATE document_types SET is_active=true, sort_order=6, category='社内申請', icon='clipboard-check', name='コンペ結果報告書' WHERE code='T05';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T05');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T05');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '担当MD', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp'), 'specific_employee', NULL, '営業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp'), 'specific_employee', NULL, '企画生産部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T05' AND true;

-- ===== T06 クレーム報告書 =====
UPDATE document_types SET is_active=true, sort_order=7, category='社内申請', icon='alert-triangle', name='クレーム報告書' WHERE code='T06';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T06');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T06');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T06' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T06' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T06' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T06' AND true;

-- ===== T08 企画外注向け注文書 =====
UPDATE document_types SET is_active=true, sort_order=8, category='業務依頼', icon='shopping-cart', name='企画外注向け注文書' WHERE code='T08';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T08');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T08');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（50万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（50万以上100万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（50万以上100万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（100万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（100万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T08' AND art.name = '企画外注注文書 承認ルート（100万以上）';

-- ===== T09 ｸﾞﾚｰﾃﾞｨﾝｸﾞﾊﾟﾀｰﾝ作製依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T09', 'ｸﾞﾚｰﾃﾞｨﾝｸﾞﾊﾟﾀｰﾝ作製依頼書', '業務依頼', 'ruler', 9, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"pattern_spec","type":"textarea","label":"パターン仕様","required":true,"rows":6},{"id":"size_table","type":"table","label":"サイズ展開","columns":[{"id":"size","type":"text","label":"サイズ","width":"20%"},{"id":"quantity","type":"number","label":"数量","width":"20%"},{"id":"unit_price","type":"currency","label":"単価","width":"20%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"20%"}],"minRows":1,"maxRows":20},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(size_table.subtotal)"},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"基本情報","fields":["project_name"]},{"title":"パターン仕様","fields":["pattern_spec","size_table","total_amount"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T09'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'グレーディング 承認ルート（50万未満）', true, true, NULL FROM document_types dt WHERE dt.code = 'T09'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'グレーディング 承認ルート（50万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'グレーディング 承認ルート（50万以上100万未満）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"size_table","sum_column":"subtotal"},"min":500000,"max":1000000}'::jsonb FROM document_types dt WHERE dt.code = 'T09'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'グレーディング 承認ルート（50万以上100万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'グレーディング 承認ルート（100万以上）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"size_table","sum_column":"subtotal"},"min":1000000}'::jsonb FROM document_types dt WHERE dt.code = 'T09'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'グレーディング 承認ルート（100万以上）');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T09');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T09');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（50万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（50万以上100万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（50万以上100万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'hi-takahashi@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（100万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（100万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T09' AND art.name = 'グレーディング 承認ルート（100万以上）';

-- ===== T10 生地発注書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T10', '生地発注書', '業務依頼', 'package', 10, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"vendor_name","type":"text","label":"発注先","required":true},{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"fabric_items","type":"table","label":"生地明細","columns":[{"id":"fabric_name","type":"text","label":"生地名","width":"20%"},{"id":"color","type":"text","label":"色","width":"15%"},{"id":"quantity","type":"number","label":"数量(m)","width":"15%"},{"id":"unit_price","type":"currency","label":"単価","width":"15%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"15%"}],"minRows":1,"maxRows":30},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(fabric_items.subtotal)"},{"id":"delivery_date","type":"date","label":"希望納期","required":true},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"発注先情報","fields":["vendor_name","project_name"]},{"title":"生地明細","fields":["fabric_items","total_amount"]},{"title":"納期・備考","fields":["delivery_date","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T10'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '生地発注書 承認ルート（1000万未満）', true, true, NULL FROM document_types dt WHERE dt.code = 'T10'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '生地発注書 承認ルート（1000万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '生地発注書 承認ルート（1000万以上）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"fabric_items","sum_column":"subtotal"},"min":10000000}'::jsonb FROM document_types dt WHERE dt.code = 'T10'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '生地発注書 承認ルート（1000万以上）');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T10');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T10');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T10' AND art.name = '生地発注書 承認ルート（1000万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T10' AND art.name = '生地発注書 承認ルート（1000万以上）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp'), 'specific_employee', NULL, '営業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T10' AND art.name = '生地発注書 承認ルート（1000万以上）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T10' AND art.name = '生地発注書 承認ルート（1000万以上）';

-- ===== T11 付属発注書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T11', '付属発注書', '業務依頼', 'package', 11, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"vendor_name","type":"text","label":"発注先","required":true},{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"accessory_items","type":"table","label":"付属明細","columns":[{"id":"item_name","type":"text","label":"品名","width":"20%"},{"id":"spec","type":"text","label":"仕様","width":"20%"},{"id":"quantity","type":"number","label":"数量","width":"15%"},{"id":"unit_price","type":"currency","label":"単価","width":"15%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"15%"}],"minRows":1,"maxRows":30},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(accessory_items.subtotal)"},{"id":"delivery_date","type":"date","label":"希望納期","required":true},{"id":"remarks","type":"textarea","label":"備考（付属明細書を必ず添付）","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"発注先情報","fields":["vendor_name","project_name"]},{"title":"付属明細","fields":["accessory_items","total_amount"]},{"title":"納期・備考","fields":["delivery_date","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T11'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '付属発注書 承認ルート（1000万未満）', true, true, NULL FROM document_types dt WHERE dt.code = 'T11'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '付属発注書 承認ルート（1000万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '付属発注書 承認ルート（1000万以上）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"accessory_items","sum_column":"subtotal"},"min":10000000}'::jsonb FROM document_types dt WHERE dt.code = 'T11'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '付属発注書 承認ルート（1000万以上）');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T11');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T11');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T11' AND art.name = '付属発注書 承認ルート（1000万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T11' AND art.name = '付属発注書 承認ルート（1000万以上）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp'), 'specific_employee', NULL, '営業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T11' AND art.name = '付属発注書 承認ルート（1000万以上）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T11' AND art.name = '付属発注書 承認ルート（1000万以上）';

-- ===== T12 加工指図書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T12', '加工指図書', '業務依頼', 'file-spreadsheet', 12, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"customer_name","type":"text","label":"顧客名","required":true},{"id":"processing_items","type":"table","label":"加工明細","columns":[{"id":"item_name","type":"text","label":"品名","width":"20%"},{"id":"process_type","type":"text","label":"加工種別","width":"15%"},{"id":"spec","type":"text","label":"仕様","width":"15%"},{"id":"quantity","type":"number","label":"数量","width":"10%"},{"id":"unit_price","type":"currency","label":"単価","width":"15%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"15%"}],"minRows":1,"maxRows":30},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(processing_items.subtotal)"},{"id":"delivery_date","type":"date","label":"納期","required":true},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"基本情報","fields":["project_name","customer_name"]},{"title":"加工明細","fields":["processing_items","total_amount"]},{"title":"納期・備考","fields":["delivery_date","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T12'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '加工指図書 承認ルート（1000万未満）', true, true, NULL FROM document_types dt WHERE dt.code = 'T12'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '加工指図書 承認ルート（1000万未満）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '加工指図書 承認ルート（1000〜3000万）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"processing_items","sum_column":"subtotal"},"min":10000000,"max":30000000}'::jsonb FROM document_types dt WHERE dt.code = 'T12'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '加工指図書 承認ルート（1000〜3000万）');
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '加工指図書 承認ルート（3000万以上）', false, true, '{"amount_field":"total_amount","compute_from":{"table":"processing_items","sum_column":"subtotal"},"min":30000000}'::jsonb FROM document_types dt WHERE dt.code = 'T12'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '加工指図書 承認ルート（3000万以上）');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T12');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T12');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000万未満）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000万未満）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（1000〜3000万）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（3000万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（3000万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（3000万以上）';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 4, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（3000万以上）';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T12' AND art.name = '加工指図書 承認ルート（3000万以上）';

-- ===== T13 請求書 =====
UPDATE document_types SET is_active=true, sort_order=13, category='見積', icon='receipt', name='請求書' WHERE code='T13';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T13');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T13');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T13' AND true;

-- ===== T14 採寸申請書 =====
UPDATE document_types SET is_active=true, sort_order=14, category='社内申請', icon='ruler', name='採寸申請書' WHERE code='T14';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T14');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T14');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '営業課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T14' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T14' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T14' AND true;

-- ===== T15 海外出張申請書 =====
UPDATE document_types SET is_active=true, sort_order=15, category='社内申請', icon='plane', name='海外出張申請書' WHERE code='T15';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T15');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T15');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T15' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T15' AND true;
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T15' AND true;

-- ===== T16 海外出張報告書 =====
UPDATE document_types SET is_active=true, sort_order=16, category='社内申請', icon='plane', name='海外出張報告書' WHERE code='T16';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T16');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T16');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T16' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, NULL, 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), '所属部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T16' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T16' AND true;

-- ===== T17 国内出張報告書 =====
UPDATE document_types SET is_active=true, sort_order=17, category='社内申請', icon='train', name='国内出張報告書' WHERE code='T17';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T17');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T17');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T17' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, NULL, 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), '所属部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T17' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T17' AND true;

-- ===== T18 有給休暇/半休申請書 =====
UPDATE document_types SET is_active=true, sort_order=18, category='社内申請', icon='calendar', name='有給休暇/半休申請書' WHERE code='T18';
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T18');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T18');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T18' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, NULL, 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), '所属部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T18' AND true;
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T18' AND true;

-- ===== T19 レンタカー運行許可申請書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T19', 'レンタカー運行許可申請書', '社内申請', 'truck', 19, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"affiliation","type":"text","label":"所属","required":true},{"id":"expense_code","type":"text","label":"経費コード","required":false},{"id":"vehicle","type":"text","label":"車両（レンタカー/カーシェア/自家用車 等）","required":true},{"id":"trips","type":"table","label":"運行明細","columns":[{"id":"date","type":"date","label":"日付","width":"15%"},{"id":"start_time","type":"text","label":"開始予定","width":"12%"},{"id":"end_time","type":"text","label":"終了予定","width":"12%"},{"id":"from","type":"text","label":"乗車場所","width":"15%"},{"id":"to","type":"text","label":"行き先","width":"18%"},{"id":"passengers","type":"text","label":"同乗者","width":"13%"},{"id":"reason","type":"text","label":"理由","width":"15%"}],"minRows":1,"maxRows":30},{"id":"remarks","type":"textarea","label":"備考（自家用車の場合は保険証券の写しを添付）","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"申請者情報","fields":["affiliation","expense_code","vehicle"]},{"title":"運行予定","fields":["trips"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T19'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'レンタカー運行許可申請書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T19'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'レンタカー運行許可申請書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T19');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T19');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T19' AND art.name = 'レンタカー運行許可申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T19' AND art.name = 'レンタカー運行許可申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T19' AND art.name = 'レンタカー運行許可申請書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'jinji@tsukamoto.co.jp'), 'specific_employee', NULL, '本部人事課', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T19' AND art.name = 'レンタカー運行許可申請書 承認ルート';

-- ===== T20 信用調査申込書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T20', '信用調査申込書', '社内申請', 'clipboard-check', 20, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"target_name","type":"text","label":"調査先 社名","required":true},{"id":"target_address","type":"text","label":"調査先 住所","required":false},{"id":"target_rep","type":"text","label":"代表者名","required":false},{"id":"target_tel","type":"text","label":"TEL","required":false},{"id":"survey_type","type":"select","label":"調査種類","required":true,"options":[{"value":"簡易版基本データ(2期分)","label":"簡易版基本データ(2期分)"},{"value":"簡易版基本データ(3〜6期)","label":"簡易版基本データ(3〜6期)"},{"value":"調査コピー","label":"調査コピー"},{"value":"調査(普通/特急/超特急)","label":"調査(普通/特急/超特急)"}]},{"id":"purpose","type":"textarea","label":"調査目的","required":true,"rows":3},{"id":"expense_code","type":"text","label":"経費コード","required":false},{"id":"remarks","type":"textarea","label":"特記事項","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"調査先","fields":["target_name","target_address","target_rep","target_tel"]},{"title":"調査内容","fields":["survey_type","purpose"]},{"title":"その他","fields":["expense_code","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T20'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '信用調査申込書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T20'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '信用調査申込書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T20');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T20');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T20' AND art.name = '信用調査申込書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T20' AND art.name = '信用調査申込書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'kansa@tsukamoto.co.jp'), 'specific_employee', NULL, '監査室', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T20' AND art.name = '信用調査申込書 承認ルート';

-- ===== T21 得意先仕入先口座登録変更申請書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T21', '得意先仕入先口座登録変更申請書', '社内申請', 'wallet', 21, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"kubun","type":"select","label":"区分","required":true,"options":[{"value":"得意先 登録","label":"得意先 登録"},{"value":"得意先 変更","label":"得意先 変更"},{"value":"仕入先 登録","label":"仕入先 登録"},{"value":"仕入先 変更","label":"仕入先 変更"}]},{"id":"current_account_no","type":"text","label":"現口座No.","required":false},{"id":"current_account_name","type":"text","label":"現口座名","required":false},{"id":"request_detail","type":"textarea","label":"申請事項・理由","required":true,"rows":4},{"id":"department_name","type":"text","label":"部門名","required":true},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"申請区分","fields":["kubun","current_account_no","current_account_name"]},{"title":"申請内容","fields":["request_detail","department_name"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T21'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '得意先仕入先口座登録変更申請書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T21'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '得意先仕入先口座登録変更申請書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T21');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T21');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T21' AND art.name = '得意先仕入先口座登録変更申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T21' AND art.name = '得意先仕入先口座登録変更申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T21' AND art.name = '得意先仕入先口座登録変更申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 4, '業務部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T21' AND art.name = '得意先仕入先口座登録変更申請書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'kansa@tsukamoto.co.jp'), 'specific_employee', NULL, '監査室', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T21' AND art.name = '得意先仕入先口座登録変更申請書 承認ルート';

-- ===== T22 寄託依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T22', '寄託依頼書', '業務依頼', 'package', 22, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"warehouse","type":"text","label":"所在地・倉庫名","required":true},{"id":"company_name","type":"text","label":"社名","required":true},{"id":"items","type":"table","label":"寄託商品明細","columns":[{"id":"code","type":"text","label":"コード番号","width":"25%"},{"id":"product_name","type":"text","label":"商品名","width":"45%"},{"id":"quantity","type":"number","label":"数量","width":"15%"}],"minRows":1,"maxRows":50},{"id":"total_qty","type":"formula","label":"合計数量","formula":"SUM(items.quantity)"},{"id":"deposit_from","type":"date","label":"寄託期間 開始","required":true},{"id":"deposit_to","type":"date","label":"寄託期間 終了","required":true},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"寄託先","fields":["warehouse","company_name"]},{"title":"寄託明細","fields":["items","total_qty"]},{"title":"期間・備考","fields":["deposit_from","deposit_to","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T22'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '寄託依頼書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T22'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '寄託依頼書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T22');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T22');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T22' AND art.name = '寄託依頼書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '業務部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T22' AND art.name = '寄託依頼書 承認ルート';

-- ===== T23 得意先条件変更届 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T23', '得意先条件変更届', '社内申請', 'edit', 23, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"customer_name","type":"text","label":"得意先名","required":true},{"id":"effective_date","type":"date","label":"変更適用日","required":true},{"id":"change_before","type":"textarea","label":"変更前（住所/社名/代表者/取引条件）","required":true,"rows":4},{"id":"change_after","type":"textarea","label":"変更後","required":true,"rows":4},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"得意先","fields":["customer_name","effective_date"]},{"title":"変更内容","fields":["change_before","change_after"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T23'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '得意先条件変更届 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T23'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '得意先条件変更届 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T23');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T23');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T23' AND art.name = '得意先条件変更届 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T23' AND art.name = '得意先条件変更届 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 3, '事業部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T23' AND art.name = '得意先条件変更届 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 4, '業務部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T23' AND art.name = '得意先条件変更届 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'kansa@tsukamoto.co.jp'), 'specific_employee', NULL, '監査室', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T23' AND art.name = '得意先条件変更届 承認ルート';

-- ===== T24 先品振替指図書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T24', '先品振替指図書', '業務依頼', 'package', 24, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"warehouse","type":"text","label":"倉庫・取引先","required":true},{"id":"project_name","type":"text","label":"案件名","required":true},{"id":"direction","type":"select","label":"振替方向","required":true,"options":[{"value":"当社在庫 → 先品","label":"当社在庫 → 先品"},{"value":"先品 → 当社在庫","label":"先品 → 当社在庫"}]},{"id":"items","type":"table","label":"振替明細","columns":[{"id":"product_name","type":"text","label":"品名","width":"20%"},{"id":"product_no","type":"text","label":"品番","width":"15%"},{"id":"size","type":"text","label":"サイズ","width":"10%"},{"id":"color","type":"text","label":"カラー","width":"10%"},{"id":"quantity","type":"number","label":"数量","width":"10%"},{"id":"unit_price","type":"currency","label":"単価","width":"13%"},{"id":"subtotal","type":"formula","label":"金額","formula":"quantity * unit_price","width":"12%"},{"id":"note","type":"text","label":"摘要","width":"10%"}],"minRows":1,"maxRows":50},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(items.subtotal)"},{"id":"senpin_type","type":"select","label":"先品種別","required":false,"options":[{"value":"A","label":"A"},{"value":"B","label":"B"}]},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"基本情報","fields":["warehouse","project_name","direction"]},{"title":"明細","fields":["items","total_amount"]},{"title":"区分・備考","fields":["senpin_type","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T24'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '先品振替指図書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T24'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '先品振替指図書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T24');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T24');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T24' AND art.name = '先品振替指図書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp'), 'specific_employee', NULL, '業務部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T24' AND art.name = '先品振替指図書 承認ルート';

-- ===== T25 加工指図書（特需） =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T25', '加工指図書（特需）', '業務依頼', 'file-spreadsheet', 25, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"vendor_name","type":"text","label":"加工先","required":true},{"id":"product_no","type":"text","label":"品番","required":true},{"id":"product_name","type":"text","label":"品名","required":true},{"id":"user_name","type":"text","label":"ユーザー","required":false},{"id":"delivery_date","type":"date","label":"納期","required":true},{"id":"warehouse","type":"text","label":"倉庫","required":false},{"id":"factory","type":"text","label":"工場","required":false},{"id":"size_table","type":"table","label":"サイズ明細","columns":[{"id":"size","type":"text","label":"サイズ","width":"20%"},{"id":"quantity","type":"number","label":"着数","width":"20%"},{"id":"note","type":"text","label":"寸法・備考","width":"55%"}],"minRows":1,"maxRows":30},{"id":"spec","type":"textarea","label":"仕様・納品での注意事項","required":true,"rows":5}],"layout":{"type":"sections","sections":[{"title":"加工先情報","fields":["vendor_name","product_no","product_name","user_name"]},{"title":"納品情報","fields":["delivery_date","warehouse","factory"]},{"title":"サイズ・仕様","fields":["size_table","spec"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T25'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '加工指図書（特需） 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T25'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '加工指図書（特需） 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T25');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T25');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T25' AND art.name = '加工指図書（特需） 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '企画生産部長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'a-saito@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T25' AND art.name = '加工指図書（特需） 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'y-mito@tsukamoto.co.jp'), 'specific_employee', NULL, '生産担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T25' AND art.name = '加工指図書（特需） 承認ルート';

-- ===== T26 口座外販売承認書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T26', '口座外販売承認書', '社内申請', 'wallet', 26, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"division_name","type":"text","label":"事業部名","required":true},{"id":"sales_target","type":"text","label":"販売先名","required":true},{"id":"address","type":"text","label":"住所","required":false},{"id":"tel","type":"text","label":"TEL","required":false},{"id":"introducer","type":"text","label":"紹介者","required":false},{"id":"relationship","type":"text","label":"販売先との関係","required":false},{"id":"estimated_amount","type":"currency","label":"販売概算額","required":true},{"id":"collection_date","type":"date","label":"回収日","required":true},{"id":"collection_method","type":"select","label":"回収方法","required":true,"options":[{"value":"現金引換","label":"現金引換"},{"value":"買掛相殺","label":"買掛相殺"},{"value":"振込","label":"振込"},{"value":"その他(一部延払等)","label":"その他(一部延払等)"}]},{"id":"collection_manager","type":"text","label":"回収責任者","required":true},{"id":"remarks","type":"textarea","label":"備考（伝票番号等）","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"販売先","fields":["division_name","sales_target","address","tel","introducer","relationship"]},{"title":"回収","fields":["estimated_amount","collection_date","collection_method","collection_manager"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T26'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '口座外販売承認書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T26'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '口座外販売承認書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T26');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T26');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T26' AND art.name = '口座外販売承認書 承認ルート';

-- ===== T27 消耗品購入申請書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T27', '消耗品購入申請書', '社内申請', 'shopping-cart', 27, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"affiliation","type":"text","label":"所属","required":true},{"id":"items","type":"textarea","label":"購入希望物品・数量（メーカー・品番等）","required":true,"rows":4},{"id":"purpose","type":"textarea","label":"用途","required":false,"rows":2},{"id":"urgency","type":"select","label":"緊急度","required":true,"options":[{"value":"急ぐ","label":"急ぐ"},{"value":"急がない","label":"急がない"}]},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"申請者","fields":["affiliation"]},{"title":"購入内容","fields":["items","purpose","urgency"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T27'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '消耗品購入申請書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T27'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '消耗品購入申請書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T27');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T27');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T27' AND art.name = '消耗品購入申請書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T27' AND art.name = '消耗品購入申請書 承認ルート';

-- ===== T28 廃棄依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T28', '廃棄依頼書', '業務依頼', 'alert-triangle', 28, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"warehouse","type":"text","label":"倉庫名","required":true},{"id":"customer_name","type":"text","label":"お客様名","required":true},{"id":"items","type":"table","label":"廃棄明細","columns":[{"id":"product_no","type":"text","label":"品番","width":"15%"},{"id":"product_name","type":"text","label":"商品名","width":"25%"},{"id":"size","type":"text","label":"サイズ","width":"10%"},{"id":"quantity","type":"number","label":"数量","width":"10%"},{"id":"unit_price","type":"currency","label":"単価","width":"13%"},{"id":"subtotal","type":"formula","label":"計","formula":"quantity * unit_price","width":"12%"},{"id":"reason","type":"text","label":"理由","width":"15%"}],"minRows":1,"maxRows":50},{"id":"total_amount","type":"formula","label":"合計金額","formula":"SUM(items.subtotal)"},{"id":"contact_note","type":"textarea","label":"連絡事項","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"依頼先","fields":["warehouse","customer_name"]},{"title":"廃棄明細","fields":["items","total_amount"]},{"title":"連絡事項","fields":["contact_note"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T28'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '廃棄依頼書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T28'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '廃棄依頼書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T28');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T28');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T28' AND art.name = '廃棄依頼書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp'), 'specific_employee', NULL, '業務部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T28' AND art.name = '廃棄依頼書 承認ルート';

-- ===== T29 限度オーバー報告書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T29', '限度オーバー報告書', '社内申請', 'alert-circle', 29, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"sales_dept","type":"text","label":"所属課","required":true},{"id":"occurrence_date","type":"date","label":"発生日","required":true},{"id":"sales_target","type":"text","label":"販売先","required":true},{"id":"base_limit","type":"currency","label":"基本限度","required":true},{"id":"content","type":"textarea","label":"内容","required":true,"rows":3},{"id":"cause","type":"textarea","label":"原因","required":true,"rows":3},{"id":"countermeasure","type":"textarea","label":"対策","required":true,"rows":3}],"layout":{"type":"sections","sections":[{"title":"基本情報","fields":["sales_dept","occurrence_date","sales_target","base_limit"]},{"title":"報告","fields":["content","cause","countermeasure"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T29'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '限度オーバー報告書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T29'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '限度オーバー報告書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T29');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T29');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T29' AND art.name = '限度オーバー報告書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T29' AND art.name = '限度オーバー報告書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T29' AND art.name = '限度オーバー報告書 承認ルート';

-- ===== T30 交際接待費申請書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T30', '交際接待費申請書', '社内申請', 'wallet', 30, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"affiliation","type":"text","label":"所属","required":true},{"id":"entertain_date","type":"date","label":"接待予定日","required":true},{"id":"customer_name","type":"text","label":"得意先名","required":true},{"id":"customer_contact","type":"text","label":"先方担当者","required":false},{"id":"customer_count","type":"number","label":"得意先人数","required":false},{"id":"our_count","type":"number","label":"当方人数","required":false},{"id":"planned_amount","type":"currency","label":"予定金額（税別）","required":true},{"id":"content","type":"textarea","label":"内容","required":true,"rows":3},{"id":"actual_amount","type":"currency","label":"実費金額","required":false}],"layout":{"type":"sections","sections":[{"title":"申請者","fields":["affiliation"]},{"title":"接待情報","fields":["entertain_date","customer_name","customer_contact","customer_count","our_count"]},{"title":"金額・内容","fields":["planned_amount","content","actual_amount"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T30'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '交際接待費申請書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T30'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '交際接待費申請書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T30');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T30');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T30' AND art.name = '交際接待費申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T30' AND art.name = '交際接待費申請書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T30' AND art.name = '交際接待費申請書 承認ルート';

-- ===== T31 品番登録フォーマット =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T31', '品番登録フォーマット', '業務依頼', 'file-spreadsheet', 31, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"items","type":"table","label":"品番登録明細","columns":[{"id":"sales_section","type":"text","label":"販売係","width":"8%"},{"id":"window_code","type":"text","label":"窓口コード","width":"11%"},{"id":"window_name","type":"text","label":"納入窓口名","width":"16%"},{"id":"sales_type","type":"text","label":"販売区分","width":"9%"},{"id":"user_name","type":"text","label":"ユーザー名","width":"14%"},{"id":"product_type","type":"text","label":"商品区分","width":"8%"},{"id":"product_no","type":"text","label":"品番","width":"9%"},{"id":"product_name","type":"text","label":"品名","width":"15%"},{"id":"category","type":"text","label":"カテゴリー","width":"10%"}],"minRows":1,"maxRows":50},{"id":"fabric_note","type":"textarea","label":"生地の場合：仕入先・生地品番・色番","required":false,"rows":2},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"品番登録","fields":["items"]},{"title":"補足","fields":["fabric_note","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T31'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '品番登録フォーマット 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T31'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '品番登録フォーマット 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T31');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T31');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T31' AND art.name = '品番登録フォーマット 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'gyomu-bucho@tsukamoto.co.jp'), 'specific_employee', NULL, '業務部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T31' AND art.name = '品番登録フォーマット 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'joshis@tsukamoto.co.jp'), 'specific_employee', NULL, '情シス', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T31' AND art.name = '品番登録フォーマット 承認ルート';

-- ===== T32 案件終了報告書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T32', '案件終了報告書', '社内申請', 'clipboard-check', 32, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"user_name","type":"text","label":"ユーザー","required":true},{"id":"order_date","type":"date","label":"受注日","required":false},{"id":"end_date","type":"date","label":"終了日","required":true},{"id":"products","type":"table","label":"製品在庫明細","columns":[{"id":"product_name","type":"text","label":"製品名","width":"25%"},{"id":"product_no","type":"text","label":"品番","width":"15%"},{"id":"price","type":"currency","label":"売価","width":"15%"},{"id":"cost","type":"currency","label":"コスト","width":"15%"},{"id":"stock_qty","type":"number","label":"在庫合計","width":"15%"},{"id":"cost_total","type":"formula","label":"コスト合計","formula":"cost * stock_qty","width":"15%"}],"minRows":1,"maxRows":50},{"id":"final_handling","type":"textarea","label":"最終処理方法・費用負担","required":true,"rows":3},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"案件情報","fields":["user_name","order_date","end_date"]},{"title":"在庫明細","fields":["products"]},{"title":"処理・備考","fields":["final_handling","remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T32'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '案件終了報告書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T32'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '案件終了報告書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T32');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T32');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T32' AND art.name = '案件終了報告書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '営業部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T32' AND art.name = '案件終了報告書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T32' AND art.name = '案件終了報告書 承認ルート';

-- ===== T33 特別費用申請書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T33', '特別費用申請書', '社内申請', 'wallet', 33, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"cost_code","type":"text","label":"係コード","required":false},{"id":"item","type":"select","label":"項目","required":true,"options":[{"value":"運搬","label":"運搬"},{"value":"物流","label":"物流"},{"value":"検品","label":"検品"},{"value":"企画","label":"企画"},{"value":"他","label":"他"}]},{"id":"property_name","type":"text","label":"物件名","required":true},{"id":"payee","type":"text","label":"支払先","required":true},{"id":"content","type":"textarea","label":"内容","required":true,"rows":3},{"id":"cost_bearer","type":"select","label":"費用負担","required":true,"options":[{"value":"先方","label":"先方"},{"value":"当社","label":"当社"},{"value":"メーカー","label":"メーカー"}]},{"id":"allocation","type":"textarea","label":"分担詳細","required":false,"rows":2},{"id":"planned_date","type":"date","label":"処理予定日","required":true},{"id":"amount","type":"currency","label":"金額","required":true},{"id":"method","type":"select","label":"処理方法","required":false,"options":[{"value":"経費","label":"経費"},{"value":"仕入","label":"仕入"}]},{"id":"remarks","type":"textarea","label":"備考","required":false,"rows":2}],"layout":{"type":"sections","sections":[{"title":"申請情報","fields":["cost_code","item","property_name","payee"]},{"title":"費用","fields":["content","cost_bearer","allocation","planned_date","amount","method"]},{"title":"備考","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T33'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, '特別費用申請書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T33'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = '特別費用申請書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T33');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T33');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, '所属課長', 'position_in_department', (SELECT id FROM positions WHERE code = 'KACHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T33' AND art.name = '特別費用申請書 承認ルート';
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 2, '所属部長', 'position_in_parent_department', (SELECT id FROM positions WHERE code = 'BUCHO'), NULL
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T33' AND art.name = '特別費用申請書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 's-kuroki@tsukamoto.co.jp'), 'specific_employee', NULL, '事業部長', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T33' AND art.name = '特別費用申請書 承認ルート';

-- ===== T34 システムデモ作成依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T34', 'システムデモ作成依頼書', '業務依頼', 'maximize', 34, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"dept","type":"text","label":"起票部門","required":true},{"id":"drafter","type":"text","label":"起票者名","required":true},{"id":"user_name","type":"text","label":"ユーザー名","required":true},{"id":"channel","type":"text","label":"直需 / 代理店名","required":false},{"id":"operation","type":"select","label":"運用形態","required":false,"options":[{"value":"レンタル","label":"レンタル"},{"value":"販売","label":"販売"},{"value":"その他","label":"その他"}]},{"id":"wear_start","type":"date","label":"着用開始日","required":false},{"id":"build_deadline","type":"date","label":"本番作成期日","required":true},{"id":"products","type":"table","label":"製品情報","columns":[{"id":"item_name","type":"text","label":"アイテム名称","width":"30%"},{"id":"product_no","type":"text","label":"品番","width":"25%"},{"id":"size_range","type":"text","label":"サイズ展開","width":"45%"}],"minRows":1,"maxRows":30},{"id":"approval_needed","type":"select","label":"承認機能の要否","required":true,"options":[{"value":"要","label":"要"},{"value":"不要","label":"不要"},{"value":"未定","label":"未定"}]},{"id":"approval_layers","type":"text","label":"承認者の階層","required":false},{"id":"approval_flow","type":"text","label":"承認の流れ","required":false},{"id":"stock_display","type":"select","label":"在庫表示の要否","required":false,"options":[{"value":"要","label":"要"},{"value":"不要","label":"不要"}]},{"id":"remarks","type":"textarea","label":"その他要望・特記事項","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"起票情報","fields":["dept","drafter","user_name","channel"]},{"title":"案件基本情報","fields":["operation","wear_start","build_deadline"]},{"title":"製品情報","fields":["products"]},{"title":"申請方法","fields":["approval_needed","approval_layers","approval_flow","stock_display"]},{"title":"その他","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T34'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'システムデモ作成依頼書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T34'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'システムデモ作成依頼書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T34');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T34');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, 'レンタル課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T34' AND art.name = 'システムデモ作成依頼書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'rental-sys@tsukamoto.co.jp'), 'specific_employee', NULL, 'レンタルシステム担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T34' AND art.name = 'システムデモ作成依頼書 承認ルート';

-- ===== T35 システム改修依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T35', 'システム改修依頼書', '業務依頼', 'edit', 35, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"dept","type":"text","label":"起票部門","required":true},{"id":"drafter","type":"text","label":"起票者名","required":true},{"id":"user_name","type":"text","label":"ユーザー名","required":true},{"id":"channel","type":"text","label":"直需 / 代理店名","required":false},{"id":"operation","type":"select","label":"運用形態","required":false,"options":[{"value":"レンタル","label":"レンタル"},{"value":"販売","label":"販売"},{"value":"その他","label":"その他"}]},{"id":"wear_start","type":"date","label":"着用開始日","required":false},{"id":"repair_deadline","type":"date","label":"改修期日","required":true},{"id":"estimate_no","type":"text","label":"見積書No.","required":false},{"id":"total_amount","type":"currency","label":"改修総額","required":true},{"id":"repairs","type":"table","label":"改修内容","columns":[{"id":"no","type":"text","label":"番号","width":"10%"},{"id":"content","type":"text","label":"改修内容","width":"65%"},{"id":"amount","type":"currency","label":"改修金額","width":"25%"}],"minRows":1,"maxRows":30},{"id":"remarks","type":"textarea","label":"備考（見積書を添付）","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"起票情報","fields":["dept","drafter","user_name","channel"]},{"title":"案件基本情報","fields":["operation","wear_start","repair_deadline"]},{"title":"改修内容","fields":["estimate_no","total_amount","repairs"]},{"title":"その他","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T35'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'システム改修依頼書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T35'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'システム改修依頼書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T35');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T35');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, 'レンタル課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T35' AND art.name = 'システム改修依頼書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'rental-sys@tsukamoto.co.jp'), 'specific_employee', NULL, 'レンタルシステム担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T35' AND art.name = 'システム改修依頼書 承認ルート';

-- ===== T36 システム本番依頼書 =====
INSERT INTO document_types (code, name, category, icon, sort_order, is_active)
VALUES ('T36', 'システム本番依頼書', '業務依頼', 'stamp', 36, true)
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, icon=EXCLUDED.icon, sort_order=EXCLUDED.sort_order, is_active=true;
INSERT INTO form_templates (document_type_id, version, is_current, schema)
SELECT dt.id, 1, true, '{"version":"1.0","fields":[{"id":"dept","type":"text","label":"起票所属","required":true},{"id":"drafter","type":"text","label":"起票者名","required":true},{"id":"user_name","type":"text","label":"ユーザー名","required":true},{"id":"channel","type":"text","label":"直需 / 代理店名","required":false},{"id":"operation","type":"select","label":"運用形態","required":false,"options":[{"value":"レンタル","label":"レンタル"},{"value":"販売","label":"販売"},{"value":"その他","label":"その他"}]},{"id":"wear_start","type":"date","label":"着用開始日","required":false},{"id":"build_deadline","type":"date","label":"本番作成期日","required":true},{"id":"products","type":"table","label":"製品情報","columns":[{"id":"item_name","type":"text","label":"アイテム名称","width":"30%"},{"id":"product_no","type":"text","label":"品番","width":"25%"},{"id":"size_range","type":"text","label":"サイズ展開","width":"45%"}],"minRows":1,"maxRows":30},{"id":"management_unit","type":"text","label":"管理単位（店舗毎/個人毎 等）","required":false},{"id":"employee_type","type":"text","label":"社員区分","required":false},{"id":"approval_needed","type":"select","label":"承認機能の要否","required":true,"options":[{"value":"要","label":"要"},{"value":"不要","label":"不要"},{"value":"未定","label":"未定"}]},{"id":"approval_layers","type":"text","label":"承認者の階層","required":false},{"id":"approval_flow","type":"text","label":"承認の流れ","required":false},{"id":"remarks","type":"textarea","label":"その他要望・特記事項（送り先情報は別途添付）","required":false,"rows":3}],"layout":{"type":"sections","sections":[{"title":"起票情報","fields":["dept","drafter","user_name","channel"]},{"title":"案件基本情報","fields":["operation","wear_start","build_deadline"]},{"title":"製品情報","fields":["products"]},{"title":"管理方法","fields":["management_unit","employee_type"]},{"title":"承認機能","fields":["approval_needed","approval_layers","approval_flow"]},{"title":"その他","fields":["remarks"]}]}}'::jsonb FROM document_types dt WHERE dt.code = 'T36'
AND NOT EXISTS (SELECT 1 FROM form_templates ft WHERE ft.document_type_id = dt.id AND ft.version = 1);
INSERT INTO approval_route_templates (document_type_id, name, is_default, is_active, condition)
SELECT dt.id, 'システム本番依頼書 承認ルート', true, true, NULL FROM document_types dt WHERE dt.code = 'T36'
AND NOT EXISTS (SELECT 1 FROM approval_route_templates a2 WHERE a2.document_type_id = dt.id AND a2.name = 'システム本番依頼書 承認ルート');
DELETE FROM approval_route_steps WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T36');
DELETE FROM approval_route_observers WHERE route_template_id IN (
  SELECT art.id FROM approval_route_templates art JOIN document_types dt ON dt.id=art.document_type_id WHERE dt.code='T36');
INSERT INTO approval_route_steps (route_template_id, step_order, name, assignee_type, assignee_position_id, assignee_employee_id)
SELECT art.id, 1, 'レンタル課長', 'specific_employee', NULL, (SELECT id FROM employees WHERE email = 'h-mitsuta@tsukamoto.co.jp')
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T36' AND art.name = 'システム本番依頼書 承認ルート';
INSERT INTO approval_route_observers (route_template_id, employee_id, assignee_type, assignee_position_id, label, notify_on)
SELECT art.id, (SELECT id FROM employees WHERE email = 'rental-sys@tsukamoto.co.jp'), 'specific_employee', NULL, 'レンタルシステム担当', 'approved'
FROM approval_route_templates art JOIN document_types dt ON dt.id = art.document_type_id
WHERE dt.code = 'T36' AND art.name = 'システム本番依頼書 承認ルート';

COMMIT;
