/**
 * SharePoint アップロードの動作確認スクリプト。
 *
 * 実行方法:
 *   npx tsx --env-file=.env.production scripts/test-sharepoint.ts [folder] [filename]
 *
 * 引数:
 *   folder   - SharePoint上のフォルダ名 (デフォルト: 企画外注向け注文書)
 *   filename - アップロードするファイル名 (デフォルト: _test_<timestamp>.pdf)
 *
 * ダミーPDFをアップロードし、メタデータを設定して結果を表示する。
 * テスト後はSharePoint上で手動削除してください。
 */

import { archivePdfToSharePoint, isSharePointConfigured } from '../src/lib/graph/sharepoint'

async function main() {
  const folder = process.argv[2] || '企画外注向け注文書'
  const filename = process.argv[3] || `_test_${Date.now()}.pdf`

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' SharePoint アップロード動作確認')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' フォルダ:', folder)
  console.log(' ファイル名:', filename)
  console.log('───────────────────────────────────')

  // 環境変数チェック
  const envCheck = {
    AZURE_AD_TENANT_ID: !!process.env.AZURE_AD_TENANT_ID,
    AZURE_AD_CLIENT_ID: !!process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: !!process.env.AZURE_AD_CLIENT_SECRET,
    SHAREPOINT_HOSTNAME: !!process.env.SHAREPOINT_HOSTNAME,
    SHAREPOINT_SITE_PATH: !!process.env.SHAREPOINT_SITE_PATH,
    SHAREPOINT_ROOT_FOLDER: !!process.env.SHAREPOINT_ROOT_FOLDER,
  }
  console.log(' 環境変数:')
  for (const [k, v] of Object.entries(envCheck)) {
    console.log(`   ${v ? '✅' : '❌'} ${k}`)
  }
  console.log(' ホスト名:', process.env.SHAREPOINT_HOSTNAME)
  console.log(' サイト:', process.env.SHAREPOINT_SITE_PATH)
  console.log(' ルートフォルダ:', process.env.SHAREPOINT_ROOT_FOLDER)
  console.log('───────────────────────────────────')

  if (!isSharePointConfigured()) {
    console.error(' ❌ SharePointが未設定です。環境変数を確認してください。')
    process.exit(1)
  }

  // 最小限の有効なPDFバイナリ (Adobe Reader でも開ける1ページ空PDF)
  const minimalPdf = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<<>>>>endobj\n' +
    'xref\n0 4\n' +
    '0000000000 65535 f \n' +
    '0000000010 00000 n \n' +
    '0000000056 00000 n \n' +
    '0000000098 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n168\n%%EOF\n',
    'utf-8',
  )

  console.log(' SharePointへアップロード中...')
  console.log()

  try {
    const now = new Date().toISOString()
    const result = await archivePdfToSharePoint(
      minimalPdf,
      filename,
      folder,
      {
        applicationNumber: 'TEST-' + Date.now(),
        applicantName: 'テスト申請者',
        finalApproverName: 'テスト承認者',
        submittedAt: now,
        approvedAt: now,
        approversTrail: '営業課長: テスト承認者A / 部長: テスト承認者B',
        documentTypeName: folder,
      },
    )

    console.log(' ✅ アップロード成功!')
    console.log('───────────────────────────────────')
    console.log(' Web URL:  ', result.webUrl)
    console.log(' Item ID:  ', result.itemId)
    console.log(' Drive ID: ', result.driveId)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(' SharePointの該当フォルダで以下を確認してください:')
    console.log('  1. ファイル', filename, 'が存在する')
    console.log('  2. プロパティに 申請番号 / 申請者 / 最終承認者 等が入っている')
    console.log('  3. 一覧で列ヘッダーをクリックしてソート動作')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  } catch (e) {
    console.error(' ❌ アップロード失敗:')
    console.error('   ', (e as Error).message)
    console.error()
    console.error(' エラー詳細:')
    console.error(e)
    process.exit(1)
  }
}

main()
