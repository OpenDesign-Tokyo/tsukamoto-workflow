-- Sprint 4-1: デモユーザーデータ正規化
-- 仕様書・DB・UIを完全一致させる

-- 1. 既存のテストデータをクリーンアップ（申請・承認レコード・通知を削除）
DELETE FROM notifications;
DELETE FROM approval_records;
DELETE FROM applications;

-- 2. 既存の employee_assignments を全削除（再作成する）
DELETE FROM employee_assignments;

-- 3. 従業員データを正規化
-- suzuki: 営業1課 係長 → 営業部 部長（第2承認者）
UPDATE employees SET
  name = '鈴木一郎',
  name_kana = 'スズキイチロウ'
WHERE email = 'suzuki@tsukamoto-demo.com';

-- takahashi: 営業部 部長 → 営業2課 課長
UPDATE employees SET
  name = '高橋美咲',
  name_kana = 'タカハシミサキ'
WHERE email = 'takahashi@tsukamoto-demo.com';

-- yamamoto → yamada: 事業部長（最終承認者）
UPDATE employees SET
  name = '山田次郎',
  name_kana = 'ヤマダジロウ',
  email = 'yamada@tsukamoto-demo.com'
WHERE email = 'yamamoto@tsukamoto-demo.com';

-- 4. employee_assignments を正しい組み合わせで再作成
-- 田中太郎: 営業1課 / 一般社員
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'tanaka@tsukamoto-demo.com'
  AND d.code = 'UNI-SALES-1'
  AND p.code = 'IPPAN';

-- 佐藤花子: 営業1課 / 課長
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'sato@tsukamoto-demo.com'
  AND d.code = 'UNI-SALES-1'
  AND p.code = 'KACHO';

-- 鈴木一郎: 営業部 / 部長（第2承認者）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'suzuki@tsukamoto-demo.com'
  AND d.code = 'UNI-SALES'
  AND p.code = 'BUCHO';

-- 山田次郎: ユニフォーム事業部 / 事業部長（最終承認者）
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'yamada@tsukamoto-demo.com'
  AND d.code = 'UNI'
  AND p.code = 'JIGYOBUCHO';

-- 高橋美咲: 営業2課 / 課長
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'takahashi@tsukamoto-demo.com'
  AND d.code = 'UNI-SALES-2'
  AND p.code = 'KACHO';

-- 管理者: 業務管理部 / 課長
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'admin@tsukamoto-demo.com'
  AND d.code = 'UNI-OPS'
  AND p.code = 'KACHO';
