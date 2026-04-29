# ツカモトワークフロー システム仕様書

## 1. システム概要

### 1.1 目的
ツカモトワークフローは、社内の各種申請・承認業務を電子化し、ペーパーレスかつ効率的なワークフロー管理を実現するWebアプリケーションです。

### 1.2 システムURL
- **本番環境**: https://tsukamoto-workflow.vercel.app
- **リポジトリ**: https://github.com/OpenDesign-Tokyo/tsukamoto-workflow

### 1.3 技術スタック
| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router, TypeScript) |
| スタイリング | Tailwind CSS v4 |
| UIコンポーネント | shadcn/ui |
| フォーム | react-hook-form + zod |
| テーブル | @tanstack/react-table |
| データベース | Supabase (PostgreSQL + RLS) |
| 認証 | Microsoft Entra ID (Azure AD) SSO |
| 通知 | Microsoft Teams (Power Automate Webhook + Adaptive Card) |
| PDF出力 | カスタム実装 |
| ホスティング | Vercel |
| アイコン | Lucide React |

---

## 2. 認証・ログイン

### 2.1 Microsoft 365 SSO
- Microsoft Entra ID (旧 Azure AD) を使用したOAuth 2.0 PKCE認証
- ログイン画面から「Microsoft 365でログイン」ボタンで認証開始
- 認証後、コールバック処理でメールアドレスと社員データを照合
- Azure AD テナントID: `97641f9f-2d1e-4f7c-a82d-7b2edad4232c`
- アプリケーションID: `9e5b2fa9-765b-4aea-b691-f521da7d377d`

### 2.2 デモログイン
- 開発・検証用にメールアドレスのみでログインするモードも搭載
- `employees`テーブルのメールアドレスと照合し、一致すればログイン

### 2.3 認可
- API リクエストには `X-Demo-User-Id` ヘッダーでユーザーIDを送信
- 各APIエンドポイントでユーザーの権限を検証
- 管理者権限は `employees.is_admin = true` で判定

---

## 3. 画面一覧

### 3.1 一般ユーザー向け画面

| 画面 | パス | 説明 |
|------|------|------|
| ログイン | `/login` | Microsoft 365 SSO / デモログイン |
| ダッシュボード | `/` | 統計情報、最新の申請、承認待ち一覧 |
| 新規申請（書類選択） | `/applications/new` | 申請する書類種別を選択 |
| 新規申請（フォーム入力） | `/applications/new/[typeId]` | フォーム入力・下書き保存・申請送信 |
| 申請一覧 | `/applications` | 自分の申請一覧（フィルタ・検索・ページネーション） |
| 申請詳細 | `/applications/[id]` | 申請内容の閲覧、承認状況、コメント |
| 申請編集 | `/applications/[id]/edit` | 下書き・差戻し申請の修正・再申請 |
| 承認待ち | `/approvals` | 自分が承認者として割り当てられた申請一覧 |
| アーカイブ | `/archive` | 完了・アーカイブ済み申請の閲覧 |

### 3.2 管理者向け画面

| 画面 | パス | 説明 |
|------|------|------|
| 組織図 | `/admin/org` | 部署の階層構造管理 |
| ユーザー管理 | `/admin/users` | 社員の登録・編集・部署/役職割当 |
| 承認ルート | `/admin/routes` | 承認ルートテンプレートの設定 |
| フォーム管理 | `/admin/forms` | フォームテンプレートの作成・編集・バージョン管理 |
| 代理設定 | `/admin/proxy` | 代理申請の権限設定 |
| MS365同期 | `/admin/sync` | Microsoft Graph APIによる組織データ同期 |

---

## 4. 書類種別とフォーム

### 4.1 書類種別
書類種別（`document_types`テーブル）は申請の種類を定義します。各書類種別にはフォームテンプレートと承認ルートが紐づきます。

**現在有効な書類種別:**
| コード | 名称 | カテゴリ |
|--------|------|----------|
| T08 | 企画外注向け注文書 | 発注 |
| T14 | 仕入計上依頼書 | 経費 |
| T18 | 支払依頼書 | 経費 |

### 4.2 フォームテンプレート
- JSON Schema ベースの動的フォーム定義
- バージョン管理（1つの書類種別に複数バージョン、最新1つが有効）
- Excel テンプレートからのインポート対応

### 4.3 対応フィールドタイプ
| タイプ | 説明 | 備考 |
|--------|------|------|
| `text` | テキスト入力 | |
| `number` | 数値入力 | |
| `date` | 日付選択 | `defaultValue: 'today'` で当日自動入力 |
| `select` | プルダウン選択 | 選択肢をオプションで定義 |
| `textarea` | 複数行テキスト | `rows` で行数指定 |
| `currency` | 金額入力 | カンマ区切り表示 |
| `table` | 明細テーブル | 行の追加・削除、列ごとに型定義 |
| `formula` | 計算フィールド | 他フィールドの値から自動計算（読み取り専用） |
| `file` | ファイル添付 | |

### 4.4 フォームセクション
フォームはセクション（グループ）に分割して表示可能。各セクションにタイトルとフィールドIDのリストを定義。

---

## 5. 承認ワークフロー

### 5.1 申請ライフサイクル
```
下書き(draft) → 提出(submitted) → 承認中(in_approval) → 決裁完了(approved)
                                                       ↘ 差戻し(rejected) → 再申請 → ...
                                   → 取下げ(withdrawn)
                                                         決裁完了 → アーカイブ(archived)
```

### 5.2 承認ルートテンプレート
各書類種別に1つ以上の承認ルートを定義。条件（金額等）に応じて自動選択されます。

**承認ルートの構成要素:**
- **ルートテンプレート**: ルート名、対象書類種別、有効/無効、条件
- **承認ステップ**: 順番、ステップ名、承認者の決定方式、承認タイプ

### 5.3 金額ベースの承認ルート自動選択
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

### 5.4 承認者の決定方式
| タイプ | 説明 |
|--------|------|
| `position_in_department` | 申請者の部署から上位階層を辿り、指定役職の社員を検索 |
| `position_in_parent_department` | 親部署から上位階層を辿り、指定役職の社員を検索 |
| `specific_employee` | 特定の社員を直接指定 |
| `department_head` | 申請者の部署で最上位ランクの社員 |
| `applicant_manager` | 申請者の直属上位（同部署内で次のランク） |

### 5.5 承認フロー詳細

#### 提出時（`submitApplication`）
1. 申請情報と承認ルートのステップを取得
2. 管理者の自己申請の場合 → 1ステップの自己承認
3. 各ステップについて承認者を解決（組織階層に基づく）
4. 解決できないステップは自動スキップ
5. 最初の有効なステップの承認者にTeams通知を送信
6. ステータスを `in_approval` に更新

#### 承認時（`approveApplication`）
1. 承認レコードを `approved` に更新
2. 最終ステップの場合 → ステータスを `approved` に更新、申請者に通知
3. 次のステップがある場合 → 次の承認者を解決して通知
4. 解決できないステップは自動スキップ

#### 差戻し時（`rejectApplication`）
1. 承認レコードを `rejected` に更新（コメント必須）
2. ステータスを `rejected` に更新
3. 申請者に差戻し通知を送信

#### 取下げ時（`withdrawApplication`）
1. 申請者本人（または代理申請者）のみ実行可能
2. 全ての未処理承認レコードを `skipped` に更新
3. ステータスを `withdrawn` に更新
4. 承認待ちの承認者に取下げ通知を送信

### 5.6 承認タイプ
| タイプ | 説明 |
|--------|------|
| `single` | 1名の承認者が承認すれば次へ進む |
| `all` | 全ての承認者が承認する必要がある |
| `any` | いずれか1名が承認すれば次へ進む |

---

## 6. 代理申請

### 6.1 概要
代理者（proxy）が本人（principal）に代わって申請を作成・提出できる機能です。承認フローは本人の部署・役職に基づいて自動解決されます。

### 6.2 代理設定
管理画面（`/admin/proxy`）で設定:
- **委任者（principal）**: 代理申請される本人
- **代理者（proxy）**: 代わりに申請する人
- **対象書類種別**: 全書類 or 特定の書類種別
- **有効期間**: 開始日〜終了日
- **有効/無効フラグ**

### 6.3 代理申請の流れ
1. 代理者が申請フォームを開く
2. 代理可能なprincipalがいる場合、「申請者を選択」ドロップダウンが表示
3. principal を選択して申請を提出
4. `applicant_id` = principal（本人）、`proxy_applicant_id` = 代理者
5. 承認フローはprincipalの部署・役職で自動解決される
6. 申請一覧には代理申請分も表示される

### 6.4 権限
- 代理申請者は申請の編集・取下げも可能
- 申請詳細画面に「（代理: ○○）」と表示

---

## 7. 通知

### 7.1 アプリ内通知
- ヘッダーのベルアイコンから未読通知を確認
- 通知パネルで一覧表示
- 既読/未読管理

### 7.2 Microsoft Teams 通知
Power Automate Webhook経由でTeams DMを送信:

**通知タイプ:**
| タイプ | タイミング | 受信者 |
|--------|-----------|--------|
| `approval_request` | 承認依頼時 | 次の承認者 |
| `approved` | 最終承認完了時 | 申請者 |
| `rejected` | 差戻し時 | 申請者 |
| `reminder` | リマインド | 承認者 |
| `withdrawn` | 取下げ時 | 承認待ち承認者 |

**Adaptive Card内容:**
- 通知タイプラベル（絵文字付き）
- 申請タイトル
- 本文メッセージ
- 事実情報（申請番号、申請者、書類種別、承認ステップ）
- 「詳細を見る」リンク
- アクションボタン

### 7.3 管理者CC
全ての承認ワークフロー通知は管理者にもCC送信されます。

---

## 8. MS365 組織同期

### 8.1 概要
Microsoft Graph APIを使用して、Entra ID（Azure AD）からユーザー・部署・役職情報を取得し、システムの組織データを同期します。

### 8.2 前提条件
- Azure AD アプリに `User.Read.All`（アプリケーションの許可）を付与
- 管理者の同意を付与
- クライアントシークレットを生成
- 環境変数 `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET` を設定

### 8.3 同期の流れ
1. **接続確認**: Graph APIへの接続テスト
2. **プレビュー**: 変更内容を確認（新規追加/更新/無効化の一覧）
3. **同期実行**: 確認後にワンクリックで適用

### 8.4 同期ロジック
- Graph API `GET /users` から全ユーザーを取得
- `@tsukamoto.co.jp` ドメインのアカウントのみ対象
- 会議室・共用アカウントは除外
- メールアドレスで既存社員とマッチング
  - **新規**: employeesテーブルに追加
  - **更新**: 名前の変更を反映
  - **無効化**: Entra IDに存在しない社員を非活性化
- Entra IDの`department`フィールド → 部署テーブル（名前マッチ、なければ新規作成）
- Entra IDの`jobTitle`フィールド → 役職テーブル（名前マッチ）
- 部署階層はAzure ADでは平坦なため、階層は管理画面で手動設定

### 8.5 注意事項
- Entra IDにdepartment/jobTitleが未設定の社員は、既存の部署・役職データを保持
- 同期は監査ログに記録

---

## 9. API一覧

### 9.1 申請関連
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | `/api/applications` | 申請一覧（自分の申請 + 代理申請分） |
| POST | `/api/applications` | 新規申請作成（下書き or 即時提出） |
| GET | `/api/applications/[id]` | 申請詳細（フォームテンプレート・承認レコード含む） |
| PUT | `/api/applications/[id]` | 申請編集（下書き保存 or 再申請） |
| POST | `/api/applications/[id]/approve` | 承認実行 |
| POST | `/api/applications/[id]/reject` | 差戻し実行（コメント必須） |
| POST | `/api/applications/[id]/withdraw` | 取下げ実行 |

### 9.2 代理関連
| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | `/api/proxy/principals` | 代理申請可能なprincipal一覧 |

### 9.3 管理者API
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

---

## 10. データベース構造

### 10.1 組織テーブル

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

### 10.2 フォーム・書類テーブル

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

### 10.3 承認ルートテーブル

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
| can_skip | boolean | スキップ可能フラグ |
| is_stamp_required | boolean | 電子印必須フラグ |

### 10.4 申請・承認テーブル

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
| teams_notification_sent | boolean | Teams通知送信済みフラグ |

### 10.5 その他テーブル

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

## 11. PDF出力

### 11.1 機能
- 決裁完了（`approved`）の申請をPDFとしてダウンロード
- フォームデータをテンプレートに沿ってレンダリング
- 申請詳細画面の「PDF」ボタンから出力

---

## 12. 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | Supabase 匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | 必須 | Supabase サービスロールキー（RLSバイパス） |
| `NEXT_PUBLIC_APP_URL` | 推奨 | アプリケーションURL（通知リンク用） |
| `NEXT_PUBLIC_AZURE_SSO_ENABLED` | 任意 | SSO有効化フラグ |
| `TEAMS_WEBHOOK_URL` | 任意 | Power Automate Webhook URL（Teams通知用） |
| `AZURE_AD_TENANT_ID` | 任意 | Azure ADテナントID（Graph API同期用） |
| `AZURE_AD_CLIENT_ID` | 任意 | Azure ADアプリケーションID（Graph API同期用） |
| `AZURE_AD_CLIENT_SECRET` | 任意 | Azure ADクライアントシークレット（Graph API同期用） |

---

## 13. セキュリティ

### 13.1 現在の実装
- Supabase RLS はデモ用に `allow_all` ポリシー
- API ルートでユーザーIDベースの権限検証
- 管理者APIは `is_admin` チェック
- 代理申請は `proxy_settings` テーブルで有効期限・書類種別を検証

### 13.2 本番化に向けた改善点
- Supabase RLS の厳格なポリシー設定
- CSRFトークンの導入
- Rate limiting の追加
- 監査ログの強化

---

## 14. 運用ガイド

### 14.1 新しい書類種別を追加する
1. `/admin/forms` でフォームテンプレートを作成
2. `/admin/routes` で承認ルートを作成（ステップを定義）
3. 書類種別を有効化

### 14.2 組織変更時の対応
1. `/admin/org` で部署構造を更新
2. `/admin/users` で社員の部署・役職割当を変更
3. 必要に応じて承認ルートのステップを調整
4. または `/admin/sync` からMS365同期を実行

### 14.3 代理申請の設定
1. `/admin/proxy` で委任者・代理者・有効期間・対象書類を設定
2. 代理者がログインすると、申請フォームに「申請者を選択」が表示される

### 14.4 Teams通知の設定
1. Power Automateで「HTTP要求の受信時」トリガーのフローを作成
2. トリガーの「フローをトリガーできるユーザー」を「だれでも」に設定
3. 生成されたURL（`&sig=`パラメータ含む）をVercelの `TEAMS_WEBHOOK_URL` に設定
