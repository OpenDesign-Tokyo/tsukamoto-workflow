/**
 * SharePointにアップロード済みのアイテムのメタデータを取得して表示する確認スクリプト。
 *
 * 実行方法:
 *   npx tsx --env-file=.env.production scripts/verify-sharepoint-metadata.ts <itemId>
 */

import { getAccessTokenForGraph } from '../src/lib/graph/ms-graph'

async function main() {
  const itemId = process.argv[2]
  if (!itemId) {
    console.error('Usage: verify-sharepoint-metadata.ts <itemId>')
    process.exit(1)
  }

  const hostname = process.env.SHAREPOINT_HOSTNAME!
  const sitePath = process.env.SHAREPOINT_SITE_PATH!
  const token = await getAccessTokenForGraph()
  const headers = { Authorization: `Bearer ${token}` }

  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:/sites/${encodeURIComponent(sitePath)}?$select=id`, { headers })
  const site = await siteRes.json()

  const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive?$select=id`, { headers })
  const drive = await driveRes.json()

  const itemRes = await fetch(`https://graph.microsoft.com/v1.0/drives/${drive.id}/items/${itemId}/listItem/fields`, { headers })
  if (!itemRes.ok) {
    console.error('Failed:', itemRes.status, await itemRes.text())
    process.exit(1)
  }

  const fields = await itemRes.json()
  console.log('━━━ SharePoint メタデータ ━━━')
  // フィルタ: 日本語表示名のフィールドを優先表示
  const interesting = ['Title', '_x7533__x8acb__x756a__x53f7_', '_x7533__x8acb__x8005_', '_x6700__x7d42__x627f__x8a8d__x8005_', '_x627f__x8a8d__x8005__x4e00__x89a7_', '_x7533__x8acb__x65e5_', '_x627f__x8a8d__x5b8c__x4e86__x65e5_', '_x66f8__x985e__x7a2e__x5225_']
  const displayMap: Record<string, string> = {
    Title: 'Title (申請番号 兼用)',
    _x7533__x8acb__x756a__x53f7_: '申請番号',
    _x7533__x8acb__x8005_: '申請者',
    _x6700__x7d42__x627f__x8a8d__x8005_: '最終承認者',
    _x627f__x8a8d__x8005__x4e00__x89a7_: '承認者一覧',
    _x7533__x8acb__x65e5_: '申請日',
    _x627f__x8a8d__x5b8c__x4e86__x65e5_: '承認完了日',
    _x66f8__x985e__x7a2e__x5225_: '書類種別',
  }
  for (const key of interesting) {
    const val = fields[key]
    const label = displayMap[key] || key
    console.log(`  ${label.padEnd(20)}: ${val == null ? '(未設定)' : JSON.stringify(val)}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
