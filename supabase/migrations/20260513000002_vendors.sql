-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 1.3: 取引先マスタ (vendors)
-- ─────────────────────────────────────────────────────────────────────────────
-- ツカモトコーポレーションが日々やり取りする仕入先・取引先を中央管理する。
-- T08 注文書、T14 仕入計上、T18 支払依頼 のフォームで `vendor_select` 型
-- フィールドから参照され、選択時に住所・担当者・支払サイトを自動展開する。
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,                  -- 取引先コード（社内採番）
  name            text NOT NULL,                          -- 正式社名
  name_kana       text,                                   -- フリガナ（検索用）
  short_name      text,                                   -- 略称（一覧表示用）
  address         text,                                   -- 本社住所
  contact_person  text,                                   -- 担当者名
  contact_email   text,
  contact_phone   text,
  payment_terms   text,                                   -- 支払サイト（例: 月末締め翌月末払い）
  credit_limit    numeric(14, 0),                         -- 与信枠（円）
  category        text,                                   -- 取引先区分（仕入先 / 外注先 / その他）
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendors_name_idx       ON public.vendors USING btree (name);
CREATE INDEX IF NOT EXISTS vendors_name_kana_idx  ON public.vendors USING btree (name_kana);
CREATE INDEX IF NOT EXISTS vendors_active_idx     ON public.vendors USING btree (is_active) WHERE is_active = true;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_set_updated_at ON public.vendors;
CREATE TRIGGER vendors_set_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grant baseline access (matches existing pattern in 20260225000003_grants.sql)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO anon, authenticated;

-- ─── Seed sample vendors for PoC demo ───────────────────────────────────────
INSERT INTO public.vendors (code, name, name_kana, short_name, address, contact_person, contact_email, contact_phone, payment_terms, category)
VALUES
  ('V-0001', '株式会社サンプル繊維', 'サンプルセンイ', 'サンプル繊維', '東京都品川区東品川1-1-1', '山田太郎', 'yamada@sample-textile.co.jp', '03-1111-1111', '月末締め翌月末払い', '仕入先'),
  ('V-0002', '株式会社ベスト染色', 'ベストセンショク', 'ベスト染色', '大阪府大阪市中央区1-2-3',   '鈴木花子', 'suzuki@best-dye.co.jp',       '06-2222-2222', '月末締め翌々月末払い', '外注先'),
  ('V-0003', '富士縫製株式会社',     'フジホウセイ',     '富士縫製',   '静岡県富士市3-4-5',          '田中一郎', 'tanaka@fuji-sewing.co.jp',    '0545-33-3333', '月末締め翌月末払い', '外注先')
ON CONFLICT (code) DO NOTHING;
