-- Hide all document types except the 3 categories (5 types) used for initial testing:
-- T08a: 企画外注向け注文書（50万未満）
-- T08b: 企画外注向け注文書（50万以上100万未満）
-- T08c: 企画外注向け注文書（100万以上）
-- T14:  採寸申請書
-- T18:  有給休暇/半休申請書
-- Other types are kept in the system (is_active=false) for future reactivation.

BEGIN;

UPDATE document_types
SET is_active = false, updated_at = now()
WHERE code NOT IN ('T08a', 'T08b', 'T08c', 'T14', 'T18');

COMMIT;
