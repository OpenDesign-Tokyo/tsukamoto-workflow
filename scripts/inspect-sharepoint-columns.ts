/**
 * SharePointドキュメントライブラリの列の「内部名」を調査するスクリプト。
 *
 * Graph APIの listItem/fields PATCH では「displayName」ではなく「内部名」を
 * キーに使う必要がある。日本語で列を作ると内部名は URLエンコードされた
 * 形式 (例: `_x7533__x8acb__x756a__x53f7_`) になることが多い。
 *
 * 実行方法:
 *   npx tsx --env-file=.env.production scripts/inspect-sharepoint-columns.ts
 */

import { getAccessTokenForGraph } from '../src/lib/graph/ms-graph'

async function main() {
  const hostname = process.env.SHAREPOINT_HOSTNAME!
  const sitePath = process.env.SHAREPOINT_SITE_PATH!

  const token = await getAccessTokenForGraph()
  const baseHeaders = { Authorization: `Bearer ${token}` }

  // 1. Site
  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:/sites/${encodeURIComponent(sitePath)}?$select=id`, { headers: baseHeaders })
  const site = await siteRes.json()
  console.log('Site ID:', site.id)

  // 2. Drive
  const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive?$select=id,name`, { headers: baseHeaders })
  const drive = await driveRes.json()
  console.log('Drive ID:', drive.id, '/ Name:', drive.name)

  // 3. List columns (these are the actual column definitions)
  const colRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/lists/${drive.id}/columns?$select=name,displayName,columnGroup`, { headers: baseHeaders })

  if (!colRes.ok) {
    // Fallback: get the list directly via drive
    console.log('   Trying via /lists by displayName...')
    const listsRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$expand=columns($select=name,displayName)`, { headers: baseHeaders })
    const lists = await listsRes.json() as { value: Array<{ id: string; name?: string; displayName?: string; columns?: Array<{ name: string; displayName: string }> }> }
    const docLib = lists.value.find(l => l.name === 'Shared Documents' || l.displayName === 'ドキュメント' || l.displayName === '申請ワークフローアーカイブ')
    if (!docLib) {
      console.log('Could not find document library. Available lists:')
      for (const l of lists.value) console.log(' -', l.displayName, '(', l.name, ')')
      return
    }
    console.log('Found list:', docLib.displayName, '(id:', docLib.id, ')')
    console.log('\nColumns:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const col of (docLib.columns || [])) {
      console.log(`  displayName: "${col.displayName}"`)
      console.log(`  internal:    "${col.name}"`)
      console.log('───')
    }
    return
  }

  const cols = await colRes.json() as { value: Array<{ name: string; displayName: string; columnGroup?: string }> }
  console.log('\nColumns:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  // Show columns with Japanese display name (likely our custom additions)
  const customs = cols.value.filter(c => /[぀-ゟ゠-ヿ一-龯]/.test(c.displayName))
  console.log('─── 日本語表示名の列のみ表示 (' + customs.length + '件) ───')
  for (const col of customs) {
    console.log(`  "${col.displayName}"  →  internal: "${col.name}"`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
