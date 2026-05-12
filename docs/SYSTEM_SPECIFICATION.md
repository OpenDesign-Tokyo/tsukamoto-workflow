# ツカモトワークフロー システム仕様書

> **最終更新**: 2026-05-13
> **開発会社**: OpenDesign Tokyo（森口）
> **クライアント**: ツカモトコーポレーション
> **関連**: 実装ロードマップは [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) 参照

---

## 1. システム概要

### 1.1 目的
ツカモトワークフローは、ツカモトコーポレーション社内の各種申請・承認業務を電子化し、ペーパーレスかつ効率的なワークフロー管理を実現するWebアプリケーションです。

### 1.2 アクセス情報
| 項目 | URL |
|------|-----|
| 本番環境 | https://tsukamoto-workflow.vercel.app |
| Gitリポジトリ | https://github.com/OpenDesign-Tokyo/tsukamoto-workflow |
| Supabase ダッシュボード | https://supabase.com/dashboard （プロジェクト名で検索） |
| Vercel ダッシュボード | https://vercel.com （OpenDesign-Tokyo org） |

### 1.3 技術スタック
| 項目 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | Next.js (App Router, TypeScript) | 16.1.6 |
| ランタイム | React | 19.2.3 |
| スタイリング | Tailwind CSS | v4 |
| UIコンポーネント | shadcn/ui (New York style) | 最新 |
| フォーム | react-hook-form + zod | 7.x + 4.x |
| テーブル | @tanstack/react-table | 8.x |
| データベース | Supabase (PostgreSQL 17 + RLS) | - |
| 認証 | Microsoft Entra ID (Azure AD) SSO | OAuth 2.0 PKCE |
| 通知 | Microsoft Teams (Power Automate Webhook + Adaptive Card) | - |
| PDF出力 | jspdf + jspdf-autotable | 4.x / 5.x |
| Excel出力（エクスポート） | xlsx (SheetJS) | 0.18.5 |
| Excelテンプレート生成 | exceljs | 4.4.0 |
| ドラッグ&ドロップ | @dnd-kit/core, @dnd-kit/sortable | 6.x / 10.x |
| ホスティング | Vercel | - |
| アイコン | Lucide React | 0.575.x |
| 日付処理 | date-fns + react-day-picker | 4.x / 9.x |

---

## 2. インフラ構成

### 2.1 全体アーキテクチャ
```
[ブラウザ] → [Vercel (Next.js)] → [Supabase (PostgreSQL)]
                    ↓                       ↑
            [API Routes]  ──────────────────┘
                    ↓
    [Microsoft Graph API] ← [Entra ID / Teams]
```

### 2.2 Vercel（ホスティング）
- **プラン**: 現在は開発アカウント（本番移行時にクライアントのアカウントへ移管予定）
- **フレームワーク**: Next.js（自動検出）
- **ビルドコマンド**: `next build`
- **Node.js**: 18+
- **デプロイ**: `main` ブランチへの push で自動デプロイ
- **環境変数**: Vercel ダッシュボードの Settings > Environment Variables で管理
- **カスタムドメイン**: 未設定（本番移行時にクライアントドメインを設定予定）
- **特記**: `vercel.json` は不使用（デフォルト設定）、`next.config.ts` も最小構成

### 2.3 Supabase（データベース）
- **プラン**: 現在は開発アカウント（本番移行時にクライアントのアカウントへ移管予定）
- **データベース**: PostgreSQL 17
- **RLS**: 現在は `allow_all` ポリシー（開発用）。本番化時に厳格化
- **マイグレーション**: `supabase/migrations/` ディレクトリで管理、`supabase db push` で適用
- **クライアント接続**:
  - ブラウザ用: `@supabase/ssr` → `src/lib/supabase/client.ts`
  - サーバー用: `@supabase/ssr` → `src/lib/supabase/server.ts`
  - 管理者用（RLSバイパス）: `@supabase/supabase-js` service role → `src/lib/supabase/admin.ts`
- **ローカル開発**: `supabase/config.toml` に設定（API: 54321, DB: 54322, Studio: 54323）

### 2.4 Microsoft 連携
| サービス | 用途 | 状態 |
|---------|------|------|
| Entra ID (Azure AD) | SSO認証 + 組織同期 | 実装済み（テナント接続準備完了） |
| Microsoft Graph API | ユーザー・部署情報の取得 | 実装済み（モックモードで動作中） |
| Microsoft Teams | 承認通知（Adaptive Card） | 実装済み（モックモードで動作中） |
| SharePoint | 決裁文書アーカイブ | 実装済み（モックモードで動作中） |
| Power Automate | Teams Webhook 中継 | 要設定 |

**Azure AD アプリ登録情報:**
- テナントID: `97641f9f-2d1e-4f7c-a82d-7b2edad4232c`
- アプリケーションID: `9e5b2fa9-765b-4aea-b691-f521da7d377d`
- 必要なアクセス許可: `User.Read.All`（アプリケーション許可、管理者同意必要）

### 2.5 本番移行時に必要な作業
1. クライアントの Vercel アカウント作成 → リポジトリ連携 → 環境変数設定
2. クライアントの Supabase アカウント作成 → マイグレーション実行 → シードデータ投入
3. Vercel にカスタムドメイン設定（例: `workflow.tsukamoto.co.jp`）
4. Azure AD アプリのリダイレクトURI更新
5. Power Automate フロー作成 → Webhook URL 取得 → Vercel環境変数に設定
6. Supabase RLS ポリシー厳格化
7. 月額見込み: Vercel Pro $20 + Supabase Pro $25 = 約6,000円/月

---

## 3. ローカル開発環境

### 3.1 ディレクトリ構成
```
/Users/kaimoriguchi/Dev/Tsukamoto_Workflow/tsukamoto-workflow/
```

### 3.2 セットアップ手順
```bash
# 依存関係インストール
npm install

# ローカル開発サーバー起動
npm run dev          # → http://localhost:3000

# ビルド
npm run build

# Supabase ローカル起動（任意）
supabase start

# Supabase マイグレーション適用（リモート）
supabase db push
```

### 3.3 npmスクリプト
| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run lint` | ESLint 実行 |

### 3.4 環境変数（`.env.local`）
| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 必須 | Supabase サービスロールキー（RLSバイパス用） |
| `NEXT_PUBLIC_APP_URL` | 推奨 | アプリケーションURL（通知リンク用） |
| `NEXT_PUBLIC_AZURE_SSO_ENABLED` | 任意 | `true` でSSO有効化 |
| `TEAMS_WEBHOOK_URL` | 任意 | Power Automate Webhook URL（未設定時はモックモード） |
| `AZURE_AD_TENANT_ID` | 任意 | Azure AD テナントID |
| `AZURE_AD_CLIENT_ID` | 任意 | Azure AD アプリケーションID |
| `AZURE_AD_CLIENT_SECRET` | 任意 | Azure AD クライアントシークレット |
| `MS_GRAPH_CLIENT_ID` | 任意 | Microsoft Graph API クライアントID |
| `MS_GRAPH_CLIENT_SECRET` | 任意 | Microsoft Graph API クライアントシークレット |
| `SHAREPOINT_SITE_ID` | 任意 | SharePoint サイトID（アーカイブ用） |

---

## 4. プロジェクト構成（ソースコード）

### 4.1 ディレクトリツリー
```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # 認証グループ
│   │   ├── auth/callback/route.ts    #   OAuthコールバック
│   │   └── login/page.tsx            #   ログインページ
│   ├── (dashboard)/                  # 認証必須グループ（AuthGuardラップ）
│   │   ├── layout.tsx                #   ダッシュボードレイアウト
│   │   ├── page.tsx                  #   ダッシュボードホーム
│   │   ├── admin/                    #   管理者画面
│   │   │   ├── forms/                #     フォームテンプレート管理
│   │   │   ├── org/                  #     組織図管理
│   │   │   ├── proxy/                #     代理設定
│   │   │   ├── routes/               #     承認ルート管理
│   │   │   ├── sync/                 #     Entra ID同期
│   │   │   └── users/                #     ユーザー管理
│   │   ├── applications/             #   申請関連
│   │   │   ├── page.tsx              #     申請一覧
│   │   │   ├── new/page.tsx          #     書類種別選択
│   │   │   ├── new/[typeId]/page.tsx #     フォーム入力
│   │   │   ├── [id]/page.tsx         #     申請詳細
│   │   │   └── [id]/edit/page.tsx    #     申請編集
│   │   ├── approvals/page.tsx        #   承認待ち一覧
│   │   └── archive/page.tsx          #   アーカイブ
│   ├── api/                          # APIルート（後述）
│   ├── layout.tsx                    # ルートレイアウト
│   └── globals.css                   # グローバルCSS
├── components/
│   ├── admin/                        # 管理者UIコンポーネント
│   │   ├── TemplateEditor.tsx        #   フォームビルダー
│   │   ├── FieldEditor.tsx           #   フィールド編集
│   │   ├── FieldList.tsx             #   フィールドリスト
│   │   ├── SectionManager.tsx        #   セクション管理
│   │   ├── TableColumnEditor.tsx     #   テーブル列設定
│   │   ├── ExcelTemplateImporter.tsx #   Excelインポート
│   │   └── schema-validation.ts      #   スキーマバリデーション
│   ├── forms/                        # フォーム描画
│   │   ├── FormRenderer.tsx          #   動的フォームレンダラー
│   │   └── fields/                   #   フィールドコンポーネント（9種類）
│   │       ├── TextField.tsx
│   │       ├── TextareaField.tsx
│   │       ├── NumberField.tsx
│   │       ├── CurrencyField.tsx
│   │       ├── DateField.tsx
│   │       ├── SelectField.tsx
│   │       ├── FileField.tsx
│   │       ├── TableField.tsx        #   ★ Excelテンプレート・D&Dインポート含む
│   │       └── FormulaField.tsx
│   ├── layout/                       # レイアウト
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── UserSwitcher.tsx          #   デモ用ユーザー切替
│   ├── notifications/                # 通知UI
│   │   ├── NotificationBell.tsx
│   │   └── NotificationPanel.tsx
│   ├── workflow/                     # ワークフローUI
│   │   ├── ApplicationCard.tsx
│   │   ├── ApprovalActions.tsx       #   承認/差戻し/取下げボタン
│   │   ├── ApprovalTimeline.tsx      #   承認ステップ可視化
│   │   └── StatusBadge.tsx
│   └── ui/                           # shadcn/ui (35+コンポーネント)
├── hooks/                            # カスタムフック
│   ├── useApplications.ts
│   ├── useApprovals.ts
│   └── useCurrentUser.ts
└── lib/
    ├── auth/                         # 認証・認可
    │   ├── DemoAuthProvider.tsx       #   デモ認証コンテキスト
    │   ├── demo-auth.ts              #   デモ認証ユーティリティ
    │   └── require-admin.ts          #   管理者API認可ミドルウェア
    ├── graph/                        # Microsoft Graph連携
    │   ├── ms-graph.ts               #   Graph APIクライアント（トークンキャッシュ付き）
    │   ├── client.ts                 #   Teams通知 / SharePointアーカイブ
    │   └── sync.ts                   #   Entra ID → Supabase 同期エンジン
    ├── supabase/                     # Supabaseクライアント
    │   ├── client.ts                 #   ブラウザ用
    │   ├── server.ts                 #   サーバー用
    │   └── admin.ts                  #   管理者用（service role）
    ├── teams/                        # Teams連携
    │   └── cards.ts                  #   Adaptive Card ビルダー
    ├── types/                        # TypeScript型定義
    │   ├── database.ts               #   全DB型 + FormField, TableColumn等
    │   └── workflow.ts               #   ワークフロー型 + ステータスラベル
    ├── utils/                        # ユーティリティ
    │   ├── exportExcel.ts            #   Excelエクスポート
    │   ├── exportPdf.ts              #   PDFエクスポート
    │   ├── format.ts                 #   日付・金額フォーマット
    │   ├── generateTableTemplate.ts  #   ★ exceljsによるExcelテンプレート生成
    │   ├── parseExcelToSchema.ts     #   Excelからフォームスキーマ変換
    │   └── validateForm.ts           #   フォームバリデーション
    ├── workflow/                     # ワークフローエンジン
    │   ├── engine.ts                 #   ★ コアロジック（submit/approve/reject/withdraw）
    │   ├── resolver.ts               #   承認者解決（階層探索）
    │   ├── notifications.ts          #   通知サービス
    │   └── route-selector.ts         #   ルート自動選択（金額条件）
    ├── audit/
    │   └── logger.ts                 #   監査ログ
    └── utils.ts                      #   cn() ユーティリティ
```

### 4.2 マイグレーションファイル
```
supabase/migrations/
├── 20260225000001_schema.sql                      # 初期スキーマ（全テーブル定義）
├── 20260225000002_seed.sql                        # シードデータ（デモユーザー）
├── 20260225000003_grants.sql                      # RLS/権限設定
├── 20260226000001_templates_and_routes.sql        # フォームテンプレート・承認ルート
├── 20260226000002_fix_admin_assignment.sql        # 管理者割当修正
├── 20260227000001_fix_demo_users.sql              # デモユーザー修正
├── 20260227000002_comments_and_fixes.sql          # コメント追加
├── 20260403000001_real_org_and_routes.sql         # ★ ツカモト実組織データ投入
├── 20260403000002_add_moriguchi.sql               # 森口ユーザー追加
├── 20260403000003_moriguchi_opendesign.sql        # OpenDesignルート
├── 20260403000004_rename_opendesign_add_tsukamoto.sql # 名称変更
├── 20260415000001_hide_unused_document_types.sql  # 未使用書類種別非表示
├── 20260415000002_merge_t08_amount_routes.sql     # T08ルート統合
├── 20260430000001_t08_remove_standalone_fields.sql # T08フィールド整理
├── 20260501000001_make_takahashi_admin.sql        # 管理者追加
├── 20260501000002_multi_approver.sql              # ★ 複数承認者対応
└── 20260501000003_t08_update_template.sql         # ★ T08テンプレート更新
```

---

## 5. 認証・ログイン

### 5.1 Microsoft 365 SSO
- Microsoft Entra ID (旧 Azure AD) を使用したOAuth 2.0 PKCE認証
- ログイン画面から「Microsoft 365でログイン」ボタンで認証開始
- 認証後、コールバック処理（`/auth/callback`）でメールアドレスと社員データを照合
- Supabase Auth のAzure ADプロバイダーを利用

### 5.2 デモログイン
- 開発・検証用にメールアドレスのみでログインするモードを搭載
- `employees`テーブルのメールアドレスと照合し、一致すればログイン
- ユーザーIDを `localStorage` に `current_employee_id` として保存
- `DemoAuthProvider`（Reactコンテキスト）でアプリ全体に認証状態を提供

### 5.3 認可
- API リクエストには `X-Demo-User-Id` ヘッダーでユーザーIDを送信
- 各APIエンドポイントでユーザーの権限を検証
- 管理者権限は `employees.is_admin = true` で判定
- 全管理者APIは共通ユーティリティ `requireAdmin(req)` で認可チェック（`lib/auth/require-admin.ts`）
  - ヘッダーからユーザーIDを取得し、`is_admin = true` を検証
  - 非管理者の場合は `403 Forbidden` を返却

---

## 6. 画面一覧

### 6.1 一般ユーザー向け画面

| 画面 | パス | 説明 |
|------|------|------|
| ログイン | `/login` | Microsoft 365 SSO / デモログイン |
| ダッシュボード | `/` | 統計情報、最新の申請、承認待ち一覧 |
| 新規申請（書類選択） | `/applications/new` | 申請する書類種別を選択 |
| 新規申請（フォーム入力） | `/applications/new/[typeId]` | フォーム入力・下書き保存・申請送信 |
| 申請一覧 | `/applications` | 自分の申請一覧（フィルタ・検索・ページネーション） |
| 申請詳細 | `/applications/[id]` | 申請内容の閲覧、承認状況、コメント、PDF/Excel出力 |
| 申請編集 | `/applications/[id]/edit` | 下書き・差戻し申請の修正・再申請 |
| 承認待ち | `/approvals` | 自分が承認者として割り当てられた申請一覧 |
| アーカイブ | `/archive` | 完了・アーカイブ済み申請の閲覧 |

### 6.2 管理者向け画面

| 画面 | パス | 説明 |
|------|------|------|
| 組織図 | `/admin/org` | 部署の階層構造管理 |
| ユーザー管理 | `/admin/users` | 社員の登録・編集・部署/役職割当 |
| 承認ルート | `/admin/routes` | 承認ルートテンプレートの設定（ステップのD&D並替え、承認タイプ設定） |
| フォーム管理 | `/admin/forms` | フォームテンプレートの作成・編集・バージョン管理 |
| 代理設定 | `/admin/proxy` | 代理申請の権限設定 |
| MS365同期 | `/admin/sync` | Microsoft Graph APIによる組織データ同期 |

---

## 7. 書類種別とフォーム

### 7.1 書類種別
書類種別（`document_types`テーブル）は申請の種類を定義します。各書類種別にはフォームテンプレートと承認ルートが紐づきます。

**現在有効な書類種別:**
| コード | 名称 | カテゴリ |
|--------|------|----------|
| T08 | 企画外注向け注文書 | 発注 |
| T14 | 仕入計上依頼書 | 経費 |
| T18 | 支払依頼書 | 経費 |

### 7.2 フォームテンプレート
- JSON Schema ベースの動的フォーム定義（`form_templates.schema` JSONB）
- バージョン管理（1つの書類種別に複数バージョン、`is_current = true` が有効）
- Excel テンプレートからのインポート対応（管理画面）
- Excelテンプレートからの管理画面でのスキーマ読み込みにも対応

### 7.3 対応フィールドタイプ
| タイプ | 説明 | 備考 |
|--------|------|------|
| `text` | テキスト入力 | |
| `number` | 数値入力 | |
| `date` | 日付選択 | `defaultValue: 'today'` で当日自動入力 |
| `select` | プルダウン選択 | 選択肢をオプションで定義 |
| `textarea` | 複数行テキスト | `rows` で行数指定 |
| `currency` | 金額入力 | カンマ区切り表示 |
| `table` | 明細テーブル | 行の追加・削除、列ごとに型定義、Excelテンプレートダウンロード・D&Dインポート |
| `formula` | 計算フィールド | 他フィールドの値から自動計算（読み取り専用） |
| `file` | ファイル添付 | |

### 7.4 テーブルフィールドの列タイプ
テーブルフィールド（`type: 'table'`）の `columns` 配列で定義する各列のタイプ:
| 列タイプ | 説明 |
|---------|------|
| `text` | テキスト入力列 |
| `number` | 数値入力列 |
| `currency` | 金額入力列（カンマ表示） |
| `formula` | 計算列（`formula` フィールドで式を定義、例: `{quantity}*{unit_price}`） |

### 7.5 テンプレート設定（templateConfig）
テーブルフィールドの `templateConfig` で、Excelテンプレート生成時のレイアウトを制御:
```typescript
templateConfig?: {
  title?: string           // テンプレートタイトル（例: "注文書"）
  headerFields?: { label: string }[]  // ヘッダーフィールド（例: 職出し日, 納期）
  footerFields?: { label: string }[]  // フッターフィールド（例: 成果物, 納入先, 支払方法）
  dataRows?: number        // 初期データ行数（デフォルト: 10）
  taxNote?: string         // 税注記（例: "※金額は税抜きです"）
}
```

### 7.6 フォームセクション
フォームはセクション（グループ）に分割して表示可能。各セクションにタイトルとフィールドIDのリストを定義。

---

## 8. 承認ワークフロー

### 8.1 申請ライフサイクル
```
下書き(draft) → 提出(submitted) → 承認中(in_approval) → 決裁完了(approved)
                                                       ↘ 差戻し(rejected) → 再申請 → ...
                                   → 取下げ(withdrawn)
                                                         決裁完了 → アーカイブ(archived)
```

### 8.2 承認ルートテンプレート
各書類種別に1つ以上の承認ルートを定義。条件（金額等）に応じて自動選択されます。

**承認ルートの構成要素:**
- **ルートテンプレート**: ルート名、対象書類種別、有効/無効、条件
- **承認ステップ**: 順番（D&Dで並替え可能）、ステップ名、承認者の決定方式、承認タイプ（単独/OR/AND）、動的選択フラグ

### 8.3 金額ベースの承認ルート自動選択
申請内の金額に応じて承認ルートが自動選択されます。

**条件設定（`condition` JSONBフィールド）:**
```json
{
  "amount_field": "total_amount",
  "compute_from": { "table": "detail_table", "sum_column": "line_amount" },
  "min": 500000,
  "max": 1000000
}
```

- `amount_field`: フォームデータ内の金額フィールドID
- `compute_from`: 明細テーブルの合計から金額を算出する場合に指定
- `min` / `max`: 金額範囲（min以上、max未満）
- 条件に一致するルートがなければデフォルトルートを使用

**例（企画外注向け注文書 T08）:**
| 金額 | 承認ステップ |
|------|------------|
| 50万円未満 | 1段階（課長） |
| 50万円以上100万円未満 | 2段階（課長→部長） |
| 100万円以上 | 3段階（課長→部長→事業部長） |

### 8.4 承認者の決定方式
| タイプ | 説明 |
|--------|------|
| `position_in_department` | 申請者の部署から上位階層を辿り、指定役職の社員を検索 |
| `position_in_parent_department` | 親部署から上位階層を辿り、指定役職の社員を検索 |
| `specific_employee` | 特定の社員を直接指定 |
| `department_head` | 申請者の部署で最上位ランクの社員 |
| `applicant_manager` | 申請者の直属上位（同部署内で次のランク） |

### 8.5 承認フロー詳細

#### 提出時（`submitApplication` in `workflow/engine.ts`）
1. 申請情報と承認ルートのステップを取得
2. 管理者の自己申請の場合 → 1ステップの自己承認
3. 各ステップについて承認者候補を解決（`resolveApprovers` で全候補を取得）
4. 申請者が事前に選択した承認者（`selected_approvers`）がある場合はそれを優先
5. 承認タイプに応じて承認レコードを作成:
   - `single`: 候補者の中から1名のレコードを作成
   - `any` / `all`: 全候補者分のレコードを作成
6. 解決できないステップは自動スキップ
7. 最初の有効なステップの承認者にTeams通知を送信
8. ステータスを `in_approval` に更新

#### 承認時（`approveApplication`）
1. 承認レコードを `approved` に更新
2. 承認タイプ別の処理:
   - **`single`**: そのまま次ステップへ進行
   - **`any`（OR承認）**: 同一ステップの残りのpendingレコードを `skipped`（「他の承認者が承認済み」）に更新し、次ステップへ
   - **`all`（AND承認）**: 同一ステップの全レコードが `approved` か確認。未完了なら `waitingForOthers: true` を返して待機
3. 最終ステップの場合 → ステータスを `approved` に更新、申請者に通知
4. 次のステップがある場合 → 承認者を解決して通知
5. 前承認者が次ステップの承認者を選択した場合（`selectedNextApprovers`）、その指定を使用
6. 解決できないステップは自動スキップ

#### 差戻し時（`rejectApplication`）
1. 承認レコードを `rejected` に更新（コメント必須）
2. 同一ステップの残りのpendingレコードを `skipped`（「他の承認者が差戻し」）に更新
3. ステータスを `rejected` に更新
4. 申請者に差戻し通知を送信

#### 取下げ時（`withdrawApplication`）
1. 申請者本人（または代理申請者）のみ実行可能
2. 全ての未処理承認レコードを `skipped` に更新
3. ステータスを `withdrawn` に更新
4. 承認待ちの承認者に取下げ通知を送信

### 8.6 承認タイプ
| タイプ | 説明 | 動作 |
|--------|------|------|
| `single` | 1名の承認者 | 候補者から1名を選出（申請者選択 or 自動） |
| `any` | OR承認（いずれか1名） | 全候補者にレコード作成、1名承認で次へ、残りは自動スキップ |
| `all` | AND承認（全員必須） | 全候補者にレコード作成、全員が承認するまで待機 |

### 8.7 承認者の選択機能

#### 申請時の承認者選択
- 申請提出前に承認ルートのプレビューを表示（各ステップの候補者一覧）
- `single`タイプで候補者が複数いるステップ → ドロップダウンで1名選択
- `any` / `all`タイプ → 全候補者を表示（選択不要）
- 選択結果は `applications.selected_approvers` に保存

#### 動的承認者選択（`allow_dynamic_selection`）
- 承認ステップに `allow_dynamic_selection = true` を設定可能
- 前ステップの承認者が承認時に、次ステップの承認者を候補リストから選択
- 選択結果は `approval_records.selected_next_approvers` に保存
- 次ステップ作成時に選択された承認者のみレコードを作成

---

## 9. 代理申請

### 9.1 概要
代理者（proxy）が本人（principal）に代わって申請を作成・提出できる機能です。承認フローは本人の部署・役職に基づいて自動解決されます。

### 9.2 代理設定
管理画面（`/admin/proxy`）で設定:
- **委任者（principal）**: 代理申請される本人
- **代理者（proxy）**: 代わりに申請する人
- **対象書類種別**: 全書類 or 特定の書類種別
- **有効期間**: 開始日〜終了日
- **有効/無効フラグ**

### 9.3 代理申請の流れ
1. 代理者が申請フォームを開く
2. 代理可能なprincipalがいる場合、「申請者を選択」ドロップダウンが表示
3. principal を選択して申請を提出
4. `applicant_id` = principal（本人）、`proxy_applicant_id` = 代理者
5. 承認フローはprincipalの部署・役職で自動解決される
6. 申請一覧には代理申請分も表示される

### 9.4 権限
- 代理申請者は申請の編集・取下げも可能
- 申請詳細画面に「（代理: ○○）」と表示

---

## 10. 通知

### 10.1 アプリ内通知
- ヘッダーのベルアイコンから未読通知を確認
- 通知パネルで一覧表示
- 既読/未読管理

### 10.2 Microsoft Teams 通知
Power Automate Webhook経由でTeams DMを送信:

**通知タイプ:**
| タイプ | タイミング | 受信者 |
|--------|-----------|--------|
| `approval_request` | 承認依頼時 | 次の承認者 |
| `approved` | 最終承認完了時 | 申請者 |
| `rejected` | 差戻し時 | 申請者 |
| `reminder` | リマインド | 承認者 |
| `withdrawn` | 取下げ時 | 承認待ち承認者 |

**Adaptive Card内容（`lib/teams/cards.ts`で構築）:**
- 通知タイプラベル
- 申請タイトル
- 本文メッセージ
- 事実情報（申請番号、申請者、書類種別、承認ステップ）
- 「詳細を見る」リンク
- アクションボタン

### 10.3 管理者CC
全ての承認ワークフロー通知は管理者にもCC送信されます。

---

## 11. MS365 組織同期

### 11.1 概要
Microsoft Graph APIを使用して、Entra ID（Azure AD）からユーザー・部署・役職情報を取得し、システムの組織データを同期します。

### 11.2 前提条件
- Azure AD アプリに `User.Read.All`（アプリケーションの許可）を付与
- 管理者の同意を付与
- クライアントシークレットを生成
- 環境変数 `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` を設定

### 11.3 同期の流れ
1. **接続確認**: Graph APIへの接続テスト
2. **プレビュー**: 変更内容を確認（新規追加/更新/無効化の一覧）
3. **同期実行**: 確認後にワンクリックで適用

### 11.4 同期ロジック（`lib/graph/sync.ts`）
- Graph API `GET /users` から全ユーザーを取得（`$top=999` でページネーション）
- `@tsukamoto.co.jp` ドメインのアカウントのみ対象
- 会議室・共用アカウント・サービスアカウントは除外
  - 除外対象: `aim@`, `aimorder@`, `duuxdirect-info@` 等
- メールアドレスで既存社員とマッチング
  - **新規**: employeesテーブルに追加
  - **更新**: 名前の変更を反映
  - **無効化**: Entra IDに存在しない社員を非活性化
- Entra IDの`department`フィールド → 部署テーブル（名前マッチ、なければ新規作成）
- Entra IDの`jobTitle`フィールド → 役職テーブル（名前マッチ）
- 部署階層はAzure ADでは平坦なため、階層は管理画面で手動設定

### 11.5 注意事項
- Entra IDにdepartment/jobTitleが未設定の社員は、既存の部署・役職データを保持
- 同期は監査ログに記録

---

## 12. API一覧

### 12.1 申請関連
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | `/api/applications` | 申請一覧（自分の申請 + 代理申請分） |
| POST | `/api/applications` | 新規申請作成（下書き or 即時提出） |
| GET | `/api/applications/[id]` | 申請詳細（フォームテンプレート・承認レコード含む） |
| PUT | `/api/applications/[id]` | 申請編集（下書き保存 or 再申請） |
| POST | `/api/applications/[id]/approve` | 承認実行 |
| POST | `/api/applications/[id]/reject` | 差戻し実行（コメント必須） |
| POST | `/api/applications/[id]/withdraw` | 取下げ実行 |
| POST | `/api/applications/preview-route` | 承認ルートプレビュー（候補者一覧） |
| GET | `/api/applications/[id]/next-step-candidates` | 次ステップの承認者候補取得 |

### 12.2 代理関連
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | `/api/proxy/principals` | 代理申請可能なprincipal一覧 |

### 12.3 管理者API（全て `requireAdmin` 認可付き）
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET/POST | `/api/admin/employees` | 社員一覧/作成 |
| GET/PUT/DELETE | `/api/admin/employees/[id]` | 社員詳細/更新/削除 |
| GET/POST | `/api/admin/departments` | 部署一覧/作成 |
| GET/PUT/DELETE | `/api/admin/departments/[id]` | 部署詳細/更新/削除 |
| GET | `/api/admin/document-types` | 書類種別一覧 |
| GET/POST | `/api/admin/templates` | フォームテンプレート一覧/作成 |
| GET/PUT/DELETE | `/api/admin/templates/[id]` | テンプレート詳細/更新/削除 |
| POST | `/api/admin/templates/reorder` | テンプレート並び順変更 |
| GET/POST | `/api/admin/routes` | 承認ルート一覧/作成 |
| GET/PUT/DELETE | `/api/admin/routes/[id]` | 承認ルート詳細/更新/削除 |
| GET/POST | `/api/admin/proxy` | 代理設定一覧/作成 |
| PUT/DELETE | `/api/admin/proxy/[id]` | 代理設定更新/削除 |
| GET | `/api/admin/graph-sync/status` | Graph API接続状態確認 |
| GET | `/api/admin/graph-sync` | 同期プレビュー（ドライラン） |
| POST | `/api/admin/graph-sync` | 同期実行 |

### 12.4 Microsoft連携API
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| POST | `/api/graph/teams-notify` | Teams通知送信 |
| POST | `/api/graph/sp-archive` | SharePointアーカイブ |

---

## 13. データベース構造

### 13.1 組織テーブル

#### departments（部署）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| name | text | 部署名 |
| code | text | 部署コード（任意） |
| parent_id | uuid | 親部署ID（階層構造） |
| level | int | 階層レベル（1=最上位） |
| sort_order | int | 表示順 |
| is_active | boolean | 有効フラグ |

#### positions（役職）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| name | text | 役職名 |
| code | text | 役職コード（任意） |
| rank | int | ランク（小さいほど上位。承認者解決に使用） |
| is_active | boolean | 有効フラグ |

#### employees（社員）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| auth_user_id | uuid | Supabase Auth ユーザーID |
| employee_number | text | 社員番号 |
| name | text | 氏名 |
| name_kana | text | 氏名カナ |
| email | text | メールアドレス（ユニーク） |
| phone_extension | text | 内線番号 |
| avatar_url | text | アバター画像URL |
| is_admin | boolean | 管理者フラグ |
| is_active | boolean | 有効フラグ |

#### employee_assignments（部署・役職割当）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| employee_id | uuid | 社員ID |
| department_id | uuid | 部署ID |
| position_id | uuid | 役職ID |
| is_primary | boolean | 主務フラグ |
| is_active | boolean | 有効フラグ |
| started_at | date | 開始日 |
| ended_at | date | 終了日（任意） |

### 13.2 フォーム・書類テーブル

#### document_types（書類種別）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| code | text | 書類コード（T08等） |
| name | text | 書類名 |
| category | text | カテゴリ（発注/経費等） |
| description | text | 説明 |
| icon | text | アイコン名 |
| is_active | boolean | 有効フラグ |
| sort_order | int | 表示順 |

#### form_templates（フォームテンプレート）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| document_type_id | uuid | 書類種別ID |
| version | int | バージョン番号 |
| is_current | boolean | 現行バージョンフラグ |
| schema | jsonb | フォーム定義（フィールド・セクション） |
| layout | jsonb | レイアウト情報 |
| excel_mapping | jsonb | Excelマッピング情報 |

### 13.3 承認ルートテーブル

#### approval_route_templates（承認ルートテンプレート）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| document_type_id | uuid | 書類種別ID |
| name | text | ルート名 |
| description | text | 説明 |
| is_default | boolean | デフォルトルートフラグ |
| is_active | boolean | 有効フラグ |
| condition | jsonb | 条件（金額範囲等） |

#### approval_route_steps（承認ステップ）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| route_template_id | uuid | ルートテンプレートID |
| step_order | int | ステップ順序 |
| name | text | ステップ名（「課長承認」等） |
| assignee_type | text | 承認者決定方式 |
| assignee_position_id | uuid | 指定役職ID（role系タイプ用） |
| assignee_employee_id | uuid | 指定社員ID（specific_employee用） |
| approval_type | text | 承認タイプ（single/all/any） |
| allow_dynamic_selection | boolean | 動的承認者選択フラグ |
| can_skip | boolean | スキップ可能フラグ |
| is_stamp_required | boolean | 電子印必須フラグ |

### 13.4 申請・承認テーブル

#### applications（申請）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| application_number | text | 申請番号（自動採番） |
| document_type_id | uuid | 書類種別ID |
| form_template_id | uuid | 使用フォームテンプレートID |
| route_template_id | uuid | 使用承認ルートID |
| applicant_id | uuid | 申請者（本人）ID |
| proxy_applicant_id | uuid | 代理申請者ID（任意） |
| form_data | jsonb | フォーム入力データ |
| title | text | 申請タイトル |
| status | text | ステータス |
| current_step | int | 現在の承認ステップ |
| total_steps | int | 総承認ステップ数 |
| submitted_at | timestamp | 提出日時 |
| approved_at | timestamp | 決裁完了日時 |
| archived_at | timestamp | アーカイブ日時 |
| selected_approvers | jsonb | 申請時に選択された承認者 |
| sharepoint_url | text | SharePointアーカイブURL |

#### approval_records（承認レコード）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| application_id | uuid | 申請ID |
| step_order | int | ステップ順序 |
| step_name | text | ステップ名 |
| approver_id | uuid | 承認者ID |
| is_proxy | boolean | 代理承認フラグ |
| proxy_for_id | uuid | 代理対象者ID |
| action | text | アクション（pending/approved/rejected/skipped） |
| comment | text | コメント |
| acted_at | timestamp | 処理日時 |
| selected_next_approvers | jsonb | 次ステップ承認者の動的選択結果 |
| teams_notification_sent | boolean | Teams通知送信済みフラグ |

### 13.5 その他テーブル

#### proxy_settings（代理設定）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| principal_id | uuid | 委任者（本人）ID |
| proxy_id | uuid | 代理者ID |
| document_type_id | uuid | 対象書類種別ID（null=全書類） |
| valid_from | date | 有効開始日 |
| valid_until | date | 有効終了日 |
| is_active | boolean | 有効フラグ |

#### notifications（通知）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| recipient_id | uuid | 受信者ID |
| application_id | uuid | 関連申請ID |
| type | text | 通知タイプ |
| channel | text | チャネル（teams/in_app/email） |
| title | text | タイトル |
| body | text | 本文 |
| action_url | text | アクションURL |
| is_read | boolean | 既読フラグ |
| sent_at | timestamp | 送信日時 |

#### application_comments（コメント）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| application_id | uuid | 申請ID |
| author_id | uuid | 投稿者ID |
| body | text | コメント本文 |
| is_internal | boolean | 内部コメントフラグ |

#### application_attachments（添付ファイル）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| application_id | uuid | 申請ID |
| file_name | text | ファイル名 |
| file_size | int | ファイルサイズ |
| mime_type | text | MIMEタイプ |
| storage_path | text | ストレージパス |
| uploaded_by | uuid | アップロード者ID |

#### audit_logs（監査ログ）
| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid | 主キー |
| actor_id | uuid | 操作者ID |
| action | text | アクション種別 |
| target_type | text | 対象種別 |
| target_id | text | 対象ID |
| metadata | jsonb | 追加情報 |
| ip_address | text | IPアドレス |
| created_at | timestamp | 記録日時 |

---

## 14. 出力機能

### 14.1 PDF出力
- 決裁完了（`approved`）の申請をPDFとしてダウンロード
- `jspdf` + `jspdf-autotable` でクライアントサイド生成
- フォームデータをテンプレートに沿ってレンダリング
- 申請詳細画面の「PDF」ボタンから出力

### 14.2 Excel出力（エクスポート）
- 決裁完了（`approved`）の申請をExcel（.xlsx）としてダウンロード
- クライアントサイドで `xlsx`（SheetJS）ライブラリにより生成
- 申請詳細画面の「Excel」ボタンから出力

**出力構成:**
- **Sheet 1「申請内容」**: メタ情報（申請番号・申請者・提出日等）+ フォームフィールド（キー・値の行形式）
- **Sheet 2+**: テーブルフィールドごとに1シート（ヘッダー行 + データ行）
- **Sheet「承認履歴」**: ステップ名・承認者・アクション・コメント・処理日時

### 14.3 明細テンプレートExcel（テンプレート生成）
- `exceljs` ライブラリでリッチなスタイル付きExcelテンプレートを生成（`lib/utils/generateTableTemplate.ts`）
- テーブルフィールドの「テンプレート」ボタンからダウンロード
- **2シート構成**:
  - **Sheet 1「注文書」**: 色付きヘッダー（濃紺 #2B579A）、罫線、日付セル（サンプル年月日入り）、金額計算式、黄色合計行、青いフッターラベル
  - **Sheet 2「データ入力」**: シンプルなヘッダー行のみ（インポート互換用）
- `templateConfig` に基づいてヘッダーフィールド・フッターフィールド・データ行数を制御

### 14.4 Excelインポート（D&D / ファイル選択）
- `TableField.tsx` で `xlsx`（SheetJS）によりExcelファイルを読み込み
- **複数シート対応**: 「データ入力」→ 各シートの順に試行
- **ヘッダー行自動検出**: 先頭10行をスキャンし、列ラベルのマッチングでヘッダー行を特定
- **列名ベースマッピング**: 位置ではなくラベル名で列を対応付け
- **合計行スキップ**: 「合計」を含む行は自動除外
- formula列は自動計算（インポート時にクライアント側で `evaluateFormula` 実行）

---

## 15. TypeScript型定義（主要）

### 15.1 FormField（`lib/types/database.ts`）
```typescript
interface FormField {
  id: string
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency' | 'table' | 'formula' | 'file'
  label: string
  required?: boolean
  placeholder?: string
  defaultValue?: string | number
  options?: { label: string; value: string }[]
  rows?: number
  formula?: string
  columns?: TableColumn[]
  templateConfig?: {
    title?: string
    headerFields?: { label: string }[]
    footerFields?: { label: string }[]
    dataRows?: number
    taxNote?: string
  }
}
```

### 15.2 TableColumn（`lib/types/database.ts`）
```typescript
interface TableColumn {
  id: string
  label: string
  type: 'text' | 'number' | 'currency' | 'formula'
  width?: number
  formula?: string
}
```

### 15.3 ApplicationStatus（`lib/types/workflow.ts`）
```typescript
type ApplicationStatus = 'draft' | 'submitted' | 'in_approval' | 'approved' | 'rejected' | 'withdrawn' | 'archived'
```

---

## 16. セキュリティ

### 16.1 現在の実装
- Supabase RLS はデモ用に `allow_all` ポリシー
- API ルートでユーザーIDベースの権限検証
- 管理者APIは `is_admin` チェック（`requireAdmin` ミドルウェア）
- 代理申請は `proxy_settings` テーブルで有効期限・書類種別を検証

### 16.2 本番化に向けた改善点
- Supabase RLS の厳格なポリシー設定
- CSRFトークンの導入
- Rate limiting の追加
- 監査ログの強化
- `X-Demo-User-Id` ヘッダーから Supabase Auth JWT トークン認証への切替

---

## 17. 運用ガイド

### 17.1 新しい書類種別を追加する
1. `/admin/forms` でフォームテンプレートを作成
2. `/admin/routes` で承認ルートを作成（ステップを定義）
3. 書類種別を有効化

### 17.2 組織変更時の対応
1. `/admin/org` で部署構造を更新
2. `/admin/users` で社員の部署・役職割当を変更
3. 必要に応じて承認ルートのステップを調整
4. または `/admin/sync` からMS365同期を実行

### 17.3 代理申請の設定
1. `/admin/proxy` で委任者・代理者・有効期間・対象書類を設定
2. 代理者がログインすると、申請フォームに「申請者を選択」が表示される

### 17.4 Teams通知の設定
1. Power Automateで「HTTP要求の受信時」トリガーのフローを作成
2. トリガーの「フローをトリガーできるユーザー」を「だれでも」に設定
3. 生成されたURL（`&sig=`パラメータ含む）をVercelの `TEAMS_WEBHOOK_URL` に設定

### 17.5 デプロイ手順
1. コードを修正してコミット
2. `git push origin main` でVercelに自動デプロイ
3. DBスキーマ変更がある場合は `supabase db push` でマイグレーション適用
4. 環境変数追加が必要な場合はVercelダッシュボードから設定

---

## 18. 依存パッケージ一覧

### 18.1 本番依存
| パッケージ | 用途 |
|-----------|------|
| `next` (16.1.6) | フレームワーク |
| `react` / `react-dom` (19.2.3) | UIライブラリ |
| `@supabase/supabase-js` / `@supabase/ssr` | DB/認証クライアント |
| `react-hook-form` / `@hookform/resolvers` / `zod` | フォームバリデーション |
| `@tanstack/react-table` | テーブル表示 |
| `@dnd-kit/core` / `@dnd-kit/sortable` / `@dnd-kit/utilities` | ドラッグ&ドロップ |
| `tailwindcss` / `@tailwindcss/postcss` | CSS |
| `radix-ui` / `shadcn` | UIプリミティブ |
| `lucide-react` | アイコン |
| `exceljs` | Excelテンプレート生成（スタイル付き） |
| `xlsx` (SheetJS) | Excelインポート・エクスポート |
| `jspdf` / `jspdf-autotable` | PDF出力 |
| `date-fns` / `react-day-picker` | 日付処理・カレンダー |
| `next-themes` | ダーク/ライトテーマ |
| `sonner` | トースト通知 |
| `cmdk` | コマンドパレット |
| `clsx` / `class-variance-authority` / `tailwind-merge` | CSS ユーティリティ |

### 18.2 開発依存
| パッケージ | 用途 |
|-----------|------|
| `typescript` (5.x) | 型チェック |
| `eslint` / `eslint-config-next` | コード品質 |
| `@types/react` / `@types/react-dom` / `@types/node` | 型定義 |
| `tw-animate-css` | アニメーション |
