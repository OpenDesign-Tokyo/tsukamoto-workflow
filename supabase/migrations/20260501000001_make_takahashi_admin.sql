-- 高橋裕之さんを管理者に設定
UPDATE employees SET is_admin = true, updated_at = now()
WHERE email = 'hi-takahashi@tsukamoto.co.jp';
