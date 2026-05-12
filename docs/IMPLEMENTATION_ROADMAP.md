# ツカモトワークフロー 実装ロードマップ

> **作成**: 2026-05-13 (Opus 4.7 review)
> **対象**: ユニフォーム制作商社（ツカモトコーポレーション）向けPoC〜本番化
> **方針**: 3つの申請フロー（T08/T14/T18）で先行検証 → 段階的に機能拡張

---

## 戦略サマリー

| 軸 | 商用SaaS最強プレイヤー | ツカモトが取るべきポジション |
|---|---|---|
| 紙帳票そのまま電子化 | X-point Cloud / Create!Webフロー | **Excelレイアウト保持型の出力で並ぶ** |
| 経理・OCR連携 | バクラク申請 | Phase 2 で会計CSV / AI-OCR対応 |
| Teams承認完結 | Microsoft Approvals | **Adaptive Card完結を独自実装、最大の差別化** |
| 承認エンジン柔軟性 | AgileWorks / COMPANY | 金額分岐＋エスカレーション程度に絞る |
| 取引先マスタ連動 | バクラク・kintone | **商社業務の最重要機能、自前実装** |

商用SaaSが個別に持つ強み（**X-pointの帳票親和性 × バクラクの経理連携 × Teams Adaptive Card完結**）を1製品に統合できる点がフルスクラッチの価値。

---

## Phase 0 — 基盤固め（最優先・2〜3週間）

PoC稼働と並行して、本番化に耐える品質に引き上げる。

### 0.1 ワークフローエンジンの堅牢化
- [x] `engine.ts` の各関数を `try/catch` で囲み、失敗時に audit log 記録
- [x] **Postgres RPC ドラフト作成**: `supabase/migrations/20260513000003_workflow_rpc_draft.sql`（**未適用**）
  - `activate_application_step` / `approve_application_step` / `reject_application` / `finalize_application` / `withdraw_application` / `record_step_skipped`
- [ ] **Postgres RPC 切替**: `WORKFLOW_USE_RPC=1` フラグを engine.ts に追加し、staging で動作確認 → 本番反映
- [ ] `resolver.ts` の N+1 解消: 部署階層を再帰CTEで一括取得するSQL view を作成

### 0.2 テスト基盤
- [x] vitest セットアップ
- [x] `route-selector.test.ts` — 純関数なので網羅テスト
- [x] `engine.test.ts` — Supabaseクライアントをモック、submit/approve/reject/withdraw の主要パスをカバー
- [ ] `resolver.test.ts` — 5タイプの assignee_type を網羅
- [ ] `npm test` を pre-push hook + CI に

### 0.3 型定義の同期
- [x] `npm run gen:types` スクリプトで `supabase gen types typescript` を実行
- [ ] CIで型生成差分があれば失敗させる
- [ ] `lib/types/database.ts` 内の手書き型（FormField, TableColumn等）と DB型 の分離整理

### 0.4 認証・認可の本番化
- [x] `lib/auth/get-user.ts` を新設（JWT/Entra IDトークン優先、`X-Demo-User-Id` フォールバック）
- [ ] `require-admin.ts` を `getServerUser()` 経由に切り替え
- [ ] 全 API ルートで `getServerUser()` 必須化（漏れチェック）
- [ ] `NEXT_PUBLIC_AZURE_SSO_ENABLED=true` を環境変数経由で切替可能に

### 0.5 RLS ポリシーの厳格化
- [x] ドラフトマイグレーション `20260513000001_rls_strict_draft.sql` を作成（**未適用**）
- [ ] 申請者は自分の申請のみ閲覧可、承認者は割り当てられた申請のみ閲覧可
- [ ] 管理者は全件閲覧可
- [ ] 本番化直前にステージング環境で適用テスト

### 0.6 マイグレーション整理
- [ ] 初期スキーマを再構築（修正パッチを統合した1ファイル）
- [ ] `db reset` でクリーン起動できる状態を維持

---

## Phase 1 — 差別化機能（4〜6週間、PoCで価値を見せる）

### 1.1 既存帳票との親和性（X-point Cloud 模倣）
- [x] **Excel テンプレート出力の業務帳票化**: 会社ロゴ枠、申請者メタ情報、印鑑欄を `generateTableTemplate` に追加（実装済み・templateConfig拡張）
- [ ] **既存 Excel 申請書のインポート → スキーマ自動生成**: `parseExcelToSchema` を強化、ヘッダー行検出 + セル結合対応 + 既存レイアウトの保存
- [ ] **PDF 出力の業務帳票化**: jspdf で会社ロゴ・印鑑欄・申請番号バーコードを描画

### 1.2 Teams Adaptive Card 承認完結（最大の差別化）
- [x] `lib/teams/cards.ts` を拡張: `承認` / `差戻し` ボタンを Adaptive Card に追加（`Action.Execute` / `Action.ShowCard`）
- [x] `/api/teams/action` を新設: Power Automate からの action callback を受け、`approveApplication` / `rejectApplication` を実行（Bearer トークン認証）
- [x] Adaptive Card に差戻しコメント入力用の `Input.Text` を追加（required）
- [x] Power Automate フロー設計ドキュメント: `docs/POWER_AUTOMATE_TEAMS_ACTION.md`
- [x] `TEAMS_INLINE_APPROVAL_ENABLED` 環境変数で機能ゲート（デフォルト OFF = web 遷移）
- [ ] 本番テナントで Power Automate フロー作成、`TEAMS_ACTION_SECRET` + `TEAMS_INLINE_APPROVAL_ENABLED=true` 設定、E2E 動作確認

### 1.3 取引先マスタ連動（商社業務の入力負荷激減）
- [x] 新規テーブル: `vendors`（仕入先マスタ） - `supabase/migrations/20260513000002_vendors.sql`
  - `id, code, name, name_kana, short_name, address, contact_person, contact_email, contact_phone, payment_terms, credit_limit, category, is_active`
  - サンプル3社のシードデータ含む
- [x] `FormField` に新タイプ `vendor_select` を追加: 仕入先選択で他フィールドに住所・担当・支払サイトを自動展開
  - `vendorAutoFill: [{ fieldId, vendorKey }]` で自動展開先を設定
  - `vendorCategories: ['仕入先', '外注先']` で絞り込み可
- [x] `VendorField` コンポーネント + `FormRenderer` 統合（Combobox 検索 UI）
- [x] `/api/vendors` 読み取り API
- [x] 管理画面 `/admin/vendors` で CRUD（検索・カテゴリ絞り込み・無効化・編集）
- [x] CSV インポート（`/api/admin/vendors/import`、CSV パーサ単体テスト12ケース付き）
- [x] T08 フォームスキーマに `vendor_select` 投入（`20260513000004_t08_vendor_select.sql`）
- [ ] T14（仕入計上依頼書）/ T18（支払依頼書）への vendor_select 投入（実フローのすり合わせ後）

### 1.4 承認エスカレーション
- [ ] `approval_route_steps` に `escalation_days` カラム追加
- [ ] Vercel Cron Job で滞留検知 → 部長などに自動エスカレーション + Teams再通知
- [ ] 申請詳細画面に「滞留中」バッジ表示

---

### 1.4 SharePoint 自動アーカイブ ✅ 実装済み
- [x] 承認完了時に PDF を SharePoint へ自動保存（fire-and-forget）
- [x] 書類種別ごとのフォルダにルーティング (`document_types.name` と完全一致)
- [x] メタデータ列（申請番号 / 申請者 / 最終承認者 / 承認者一覧 / 申請日 / 承認完了日 / 書類種別）を listItem fields にセット
- [x] サーバーサイド PDF 生成 (`exportPdfServer.ts`, jsPDF + NotoSansJP)
- [x] 設定手順: [docs/SHAREPOINT_ARCHIVE_SETUP.md](SHAREPOINT_ARCHIVE_SETUP.md)
- [ ] 本番 Azure AD 権限 (`Sites.ReadWrite.All`) 付与 + SharePoint カラム設定 + 環境変数登録

## Phase 2 — 経理連携・拡張（PoC評価後）

### 2.1 AI-OCR で請求書 → T14 仕入計上を自動下書き
- [ ] Azure AI Document Intelligence（または Google Document AI）と連携
- [ ] 請求書 PDF アップロード → 取引先、金額、品名を抽出 → T14 フォームに自動投入
- [ ] OCR 結果に確信度スコアを表示、手動確認 UI

### 2.2 会計ソフト連携
- [ ] 仕訳 CSV エクスポート: freee / 弥生 / 勘定奉行向けフォーマット
- [ ] 決裁完了の T14/T18 を月次バッチで自動出力

### 2.3 ダッシュボード・分析
- [ ] 案件別 / 取引先別 / 部門別の集計ダッシュボード
- [ ] 承認 SLA（平均承認時間、滞留率）の可視化

### 2.4 モバイル PWA
- [ ] PWA manifest + Service Worker
- [ ] 承認待ち一覧のオフライン閲覧

---

## Phase 3 — エンタープライズ強化（本番運用後）

- [ ] 全文検索（Postgres `tsvector` または Meilisearch）
- [ ] 申請テンプレート間の依存関係（先行申請の決裁を条件にする）
- [ ] 多言語対応（英語、ベトナム語など外国人従業員向け）
- [ ] kintone 風プラグイン拡張機構（将来の社内アプリ展開）
- [ ] 2要素認証 / IP制限 / セッション管理強化

---

## 既知のリスクと回避策

| リスク | 影響 | 対策 |
|---|---|---|
| `engine.ts` にトランザクションがない | 失敗時に承認レコードと申請状態が不整合 | Phase 0.1 で Postgres RPC 化 |
| RLS が `allow_all` | 本番でデータ全件露出 | Phase 0.5 のドラフトを適用、ステージングで検証 |
| `X-Demo-User-Id` でヘッダー偽装可能 | 任意のユーザーに成りすませる | Phase 0.4 で Entra ID JWT 必須化 |
| Teams Webhook が `console.log` モック | 本番接続時にハマる | Phase 1.2 で Power Automate 設定手順をドキュメント化 |
| 部署階層が深いと N+1 | 500人規模で承認者解決が遅い | Phase 0.1.2 で再帰CTE化 |
| マイグレーションが17本に分散 | rollback / 再構築が困難 | Phase 0.6 で初期スキーマ統合 |

---

## 開発オペレーション

### 推奨フロー
1. `npm install` → 依存解決
2. `supabase start` → ローカルDB起動
3. `supabase db push` → マイグレーション適用
4. `npm run gen:types` → 型生成
5. `npm test` → ユニットテスト
6. `npm run dev` → 開発サーバー起動

### コミット規約
- Phase 番号をプレフィックスに: `[P0.2] Add engine.ts vitest cases`
- マイグレーションは1機能1ファイル、ファイル名に意図を込める

### コードレビュー観点
- 新規 API ルートは `getServerUser()` を必ず呼ぶ
- ワークフロー状態遷移を追加する場合は engine.ts の try/catch 内に
- DB スキーマ変更時は `npm run gen:types` を実行してコミット
