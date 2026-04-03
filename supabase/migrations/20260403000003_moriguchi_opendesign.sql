-- Move k-moriguchi from USP/事業部長 to OpenDesign special department
BEGIN;

-- Create OpenDesign department (top-level, separate from org tree)
INSERT INTO departments (name, code, level, sort_order)
VALUES ('OpenDesign', 'OPENDESIGN', 0, 99);

-- Create a special position for system administrator
INSERT INTO positions (name, code, rank)
VALUES ('システム管理者', 'SYS_ADMIN', 100)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, rank = EXCLUDED.rank;

-- Remove old assignment
DELETE FROM employee_assignments
WHERE employee_id = (SELECT id FROM employees WHERE email = 'k-moriguchi@tsukamoto.co.jp');

-- Create new assignment under OpenDesign
INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e, departments d, positions p
WHERE e.email = 'k-moriguchi@tsukamoto.co.jp'
  AND d.code = 'OPENDESIGN'
  AND p.code = 'SYS_ADMIN';

COMMIT;
