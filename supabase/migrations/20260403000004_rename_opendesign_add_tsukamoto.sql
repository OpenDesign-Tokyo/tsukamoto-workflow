-- Rename OpenDesign department and add Tsukamoto Harumitsu
BEGIN;

-- Rename department
UPDATE departments
SET name = '情報システム/OpenDesign部門'
WHERE code = 'OPENDESIGN';

-- Add Tsukamoto Harumitsu
INSERT INTO employees (employee_number, name, email, is_admin)
VALUES ('EMP-101', '塚本 治光', 'h-tsukamoto@tsukamoto.co.jp', true);

INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e, departments d, positions p
WHERE e.email = 'h-tsukamoto@tsukamoto.co.jp'
  AND d.code = 'OPENDESIGN'
  AND p.code = 'SYS_ADMIN';

COMMIT;
