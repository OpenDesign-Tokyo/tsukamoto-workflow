-- 管理者ユーザー(admin@tsukamoto-demo.com)にプライマリ所属を追加
-- 業務管理部 / 課長 として設定
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT
  e.id,
  d.id,
  p.id,
  true,
  true
FROM employees e
CROSS JOIN departments d
CROSS JOIN positions p
WHERE e.email = 'admin@tsukamoto-demo.com'
  AND d.code = 'UNI-OPS'
  AND p.name = '課長'
  AND NOT EXISTS (
    SELECT 1 FROM employee_assignments ea
    WHERE ea.employee_id = e.id AND ea.is_primary = true AND ea.is_active = true
  );
