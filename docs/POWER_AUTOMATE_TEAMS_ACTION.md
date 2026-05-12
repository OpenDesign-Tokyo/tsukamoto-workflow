# Power Automate フロー設計：Teams Adaptive Card で承認完結

> **対象**: Phase 1.2「Teams 承認完結」
> **エンドポイント**: `POST /api/teams/action`
> **依存環境変数**: `TEAMS_ACTION_SECRET`（Vercel）、`TEAMS_WEBHOOK_URL`（Vercel）、`TEAMS_INLINE_APPROVAL_ENABLED=true`（Vercel）
>
> **デフォルト動作**: `TEAMS_INLINE_APPROVAL_ENABLED` 未設定時は Teams カードに承認/差戻しボタンが**出ない**（「詳細を見る」リンクのみの web 遷移）。Power Automate を設定する段階になったらこの環境変数を `true` にする。

---

## 概要

承認者は Teams で受け取った Adaptive Card 上で「✅ 承認」または「🔙 差戻し」ボタンを直接押せます。Web アプリへ遷移する必要はありません。

```
[Workflow Engine]
   ↓ Power Automate Webhook (送信用)
[Power Automate: メッセージ作成フロー]
   ↓ Adaptive Card を Teams DM に投稿
[Teams クライアント]
   ↓ ユーザーが「承認」ボタンクリック → Action.Execute invoke
[Power Automate: アクション受信フロー]
   ↓ Bearer トークン付き HTTP POST
[Next.js /api/teams/action]
   ↓ engine.approveApplication / rejectApplication
[DB 更新 + 次承認者へ Teams 通知]
```

---

## セットアップ手順

### 1. シークレットの準備

Vercel の Settings → Environment Variables で以下を設定：

| 変数 | 値 |
|---|---|
| `TEAMS_ACTION_SECRET` | 任意のランダム文字列（32文字以上推奨）。`openssl rand -hex 32` で生成 |
| `TEAMS_WEBHOOK_URL` | Step 2 で作成する送信用フローの URL |

### 2. 送信用フロー：`Send-WorkflowCard`

**トリガー**: `HTTP 要求の受信時`（POST、JSON body）

受信スキーマ：
```json
{
  "type": "object",
  "properties": {
    "recipientEmail": { "type": "string" },
    "card": { "type": "object" }
  }
}
```

**アクション 1**: `Microsoft 365 ユーザー → 上司を取得（プレビュー）` などで `recipientEmail` を解決し、Teams ユーザー ID に変換。

**アクション 2**: `Microsoft Teams → チャットまたはチャネルでメッセージを投稿する`
- 投稿者: フロー bot
- 投稿先: チャット
- 受信者: 解決した Teams ユーザー
- メッセージ: 空白
- アダプティブカード: `triggerBody()['card']`（JSON形式）

> 完成後の URL（`?sig=...` 付き）を `TEAMS_WEBHOOK_URL` に設定。

### 3. アクション受信用フロー：`Handle-CardAction`

**トリガー**: `Microsoft Teams → Adaptive Card の操作が実行されたとき`（または `Power Virtual Agents` 経由でも可）

> Note: ターゲットテナントが「Adaptive Card invoke」を直接受けられない場合は、代わりに `Teams: メッセージで反応が追加されたとき` + `アダプティブカード Action.Submit` の組み合わせでもよい。最新の Universal Action モデルは [docs.microsoft.com の解説](https://learn.microsoft.com/ja-jp/microsoftteams/platform/task-modules-and-cards/cards/universal-actions-for-adaptive-cards) を参照。

トリガーから取得できるデータ：
- `verb` ─ `approve` または `reject`
- `data.applicationId`
- `data.approverId`
- `data.comment`（差戻し時のみ。`Input.Text` の `id: "comment"` 値）

**アクション 1**: `HTTP → HTTP`
- メソッド: `POST`
- URL: `https://<本番ドメイン>/api/teams/action`
- ヘッダー:
  - `Content-Type: application/json`
  - `Authorization: Bearer @{variables('TEAMS_ACTION_SECRET')}`
- 本文:
```json
{
  "verb": "@{triggerBody()?['verb']}",
  "applicationId": "@{triggerBody()?['data']?['applicationId']}",
  "approverId": "@{triggerBody()?['data']?['approverId']}",
  "comment": "@{triggerBody()?['data']?['comment']}"
}
```

**アクション 2**: `カードの応答を作成`
- `body[0].text`: `@{body('HTTP')?['message']}`
- これによりカードが応答メッセージ付きで更新される。

### 4. 動作確認

#### ステージング
1. `TEAMS_ACTION_SECRET` を仮の値で設定
2. 承認待ち申請を作成 → Teams にカードが届くこと
3. 「✅ 承認」をクリック → カードが「✅ 承認しました。次の承認者に通知を送信します。」に更新されること
4. ワークフローエンジン側で `approval_records.action = 'approved'` になっていること
5. 次承認者にカードが届くこと

#### 失敗時
- カード上にエラーメッセージが表示される
- `audit_logs` に `source: 'teams_adaptive_card'` で記録される（承認/差戻し失敗も含む）
- Vercel Logs に詳細 stack trace

---

## セキュリティ

### 信頼境界
| 信頼レベル | 対象 |
|---|---|
| **信頼**: API 自身が処理判定の基準にする | `Authorization` ヘッダーの secret、URL ホスト |
| **信頼しない**: 検証してから扱う | `verb`, `applicationId`, `approverId`, `comment` |

エンドポイント側で実施している防御：
- Bearer トークンが不一致なら 401（payload 解析前に拒否）
- `verb` が `approve` / `reject` 以外なら 400
- 差戻し時 `comment` 空なら 400
- `engine.approveApplication` 自身が `approver_id` × `pending` でフィルタするため、承認権限のない人が承認しても DB 更新されない
- すべての処理結果は `audit_logs` に source=teams_adaptive_card で記録

### シークレット運用
- `TEAMS_ACTION_SECRET` は 90 日に 1 回ローテーション推奨
- 旧キーは Power Automate 側の Variable を更新 → Vercel 側を更新の順で 30 分のオーバーラップを許容してから無効化

### 想定外の使い方を弾く
- Power Automate 以外の経路から `/api/teams/action` を直接叩かれても、Authorization ヘッダーがないと 401
- 認可は「承認者本人 = approverId」のみ。Power Automate 側で `triggerBody()['from']['id']` を `data.approverId` と照合する追加チェックを Phase 2 で導入予定

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| 単一テナント前提 | 認可で organization 跨ぎを許可していない |
| 添付ファイル | カードからの添付には未対応（詳細画面で扱う） |
| カード更新 | Universal Action `refresh` を使うと自動更新できるが、現状は手動 OpenUrl で再表示 |
| 多言語 | カード文言は日本語固定。i18n は Phase 3 で対応 |
