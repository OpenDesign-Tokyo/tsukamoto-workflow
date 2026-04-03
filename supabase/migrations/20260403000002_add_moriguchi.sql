-- Add k-moriguchi (森口 凱 / OpenDesign) as super admin
BEGIN;

INSERT INTO employees (employee_number, name, email, is_admin)
VALUES ('EMP-100', '森口 凱', 'k-moriguchi@tsukamoto.co.jp', true);

INSERT INTO employee_assignments (employee_id, department_id, position_id, is_primary, is_active)
SELECT e.id, d.id, p.id, true, true
FROM employees e, departments d, positions p
WHERE e.email = 'k-moriguchi@tsukamoto.co.jp'
  AND d.code = 'USP'
  AND p.code = 'JIGYOBUCHO';

COMMIT;
