-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2.C: 承認ルートに「閲覧者（オブザーバー）」を追加できるようにする
-- ─────────────────────────────────────────────────────────────────────────────
-- 承認権限はないが、申請の進行を「見るだけ」「通知だけ受ける」ためのユーザー枠。
-- 例: 上司への報告共有、関係部署へのCC、コンプライアンス監視部門など。
--
-- approval_route_templates の子テーブルとして実装し、ステップとは独立。
-- ルート全体に対する設定なので、特定ステップに紐付ける必要はない（将来必要なら
-- step_order 列を追加することで拡張可能）。
--
-- notify_on の値:
--   'submit'      申請提出時のみ通知
--   'each_step'   ステップ進行のたびに通知（ノイジー）
--   'approved'    最終承認完了時のみ通知（デフォルト・推奨）
--   'rejected'    差戻し時のみ通知
--   'all'         全イベントで通知
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_route_observers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_template_id  uuid NOT NULL REFERENCES public.approval_route_templates(id) ON DELETE CASCADE,
  employee_id        uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  notify_on          text NOT NULL DEFAULT 'approved'
    CHECK (notify_on IN ('submit', 'each_step', 'approved', 'rejected', 'all')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (route_template_id, employee_id)
);

CREATE INDEX IF NOT EXISTS approval_route_observers_route_idx
  ON public.approval_route_observers (route_template_id);
CREATE INDEX IF NOT EXISTS approval_route_observers_employee_idx
  ON public.approval_route_observers (employee_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_route_observers TO anon, authenticated;
