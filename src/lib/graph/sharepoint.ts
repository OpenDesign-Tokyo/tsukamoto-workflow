/**
 * SharePoint upload + metadata via Microsoft Graph API.
 *
 * Used to auto-archive approved applications: when an application reaches
 * `approved` state, engine.ts triggers a background archive that
 *   1. generates the PDF server-side (exportPdfServer.ts)
 *   2. finds the target folder by document_type name
 *   3. uploads the PDF
 *   4. sets list-item fields (申請番号 / 申請者 / 承認者 / 申請日 / 承認完了日)
 *
 * Required Azure AD app permissions (application, with admin consent):
 *   - Sites.ReadWrite.All
 *
 * Required environment variables:
 *   - AZURE_AD_TENANT_ID
 *   - AZURE_AD_CLIENT_ID
 *   - AZURE_AD_CLIENT_SECRET
 *   - SHAREPOINT_HOSTNAME       (e.g. "tsukamoto365.sharepoint.com")
 *   - SHAREPOINT_SITE_PATH      (e.g. "msteams_42ae0e", the part after /sites/)
 *   - SHAREPOINT_ROOT_FOLDER    (optional, default "" = drive root)
 */

import { isGraphConfigured, getAccessTokenForGraph } from './ms-graph'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

export interface SharePointConfig {
  hostname: string
  sitePath: string
  rootFolder: string
  /** SHAREPOINT_AUTO_CREATE_FOLDERS=1 で、書類種別フォルダが無ければ自動作成する */
  autoCreateFolders: boolean
}

export function getSharePointConfig(): SharePointConfig | null {
  const hostname = process.env.SHAREPOINT_HOSTNAME
  const sitePath = process.env.SHAREPOINT_SITE_PATH
  if (!hostname || !sitePath) return null
  const auto = process.env.SHAREPOINT_AUTO_CREATE_FOLDERS
  return {
    hostname,
    sitePath,
    rootFolder: process.env.SHAREPOINT_ROOT_FOLDER || '',
    autoCreateFolders: auto === '1' || auto === 'true',
  }
}

export function isSharePointConfigured(): boolean {
  return isGraphConfigured() && getSharePointConfig() !== null
}

// ── Site / Drive resolution (cached for the lifetime of the lambda) ──────────

interface SiteCache {
  siteId: string
  driveId: string
  /**
   * 表示名 → 内部名のマップ。
   *
   * SharePointで日本語の列を作ると内部名は `_x7533__x8acb__x756a__x53f7_`
   * のような URL エンコード形式になる。Graph API の listItem/fields PATCH
   * は内部名を要求するため、ライブラリのカラム定義から実行時にマップを
   * 構築し、メタデータ設定時に表示名を内部名へ変換する。
   */
  fieldMap: Map<string, string>
  fetchedAt: number
}
let siteCache: SiteCache | null = null
const SITE_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

async function graphRequest(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessTokenForGraph()
  return fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  })
}

async function resolveSiteAndDrive(config: SharePointConfig): Promise<SiteCache> {
  if (siteCache && Date.now() - siteCache.fetchedAt < SITE_CACHE_TTL_MS) {
    return siteCache
  }

  const sitePath = encodeURIComponent(config.sitePath)
  const siteRes = await graphRequest(`/sites/${config.hostname}:/sites/${sitePath}?$select=id`)
  if (!siteRes.ok) {
    const text = await siteRes.text()
    throw new Error(`SharePoint サイト解決失敗 (${siteRes.status}): ${text}`)
  }
  const site = (await siteRes.json()) as { id: string }

  const driveRes = await graphRequest(`/sites/${site.id}/drive?$select=id`)
  if (!driveRes.ok) {
    const text = await driveRes.text()
    throw new Error(`SharePoint ドライブ解決失敗 (${driveRes.status}): ${text}`)
  }
  const drive = (await driveRes.json()) as { id: string }

  // 列の内部名マップを構築 (失敗してもアップロード自体は続行できるので非致命)
  // ドライブに紐付くリストの列定義: /drives/{drive-id}/list/columns
  const fieldMap = new Map<string, string>()
  try {
    const colsRes = await graphRequest(`/drives/${drive.id}/list/columns?$select=name,displayName`)
    if (colsRes.ok) {
      const cols = (await colsRes.json()) as { value: Array<{ name: string; displayName: string }> }
      for (const c of cols.value) {
        if (c.displayName && c.name) fieldMap.set(c.displayName, c.name)
      }
      console.log(`[SharePoint] 列マップ構築完了 (${fieldMap.size}件)`)
    } else {
      console.warn('[SharePoint] 列定義取得失敗:', colsRes.status, await colsRes.text())
    }
  } catch (e) {
    console.warn('[SharePoint] 列定義取得エラー:', e)
  }

  siteCache = { siteId: site.id, driveId: drive.id, fieldMap, fetchedAt: Date.now() }
  return siteCache
}

/** Test seam: clear in-memory site cache. Used by unit tests and force-refresh paths. */
export function __resetSharePointCacheForTests() {
  siteCache = null
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * xlsx/docx 等の Office ファイルを Graph 経由で PDF に変換する。
 * Vercel では LibreOffice が使えないため、SharePoint ドライブに一時アップロードし
 * `/content?format=pdf` で変換結果を取得、その後一時ファイルを削除する。
 *
 * SharePoint 未設定・変換失敗時は null を返す（呼び元は xlsx にフォールバック）。
 */
export async function convertOfficeToPdfViaGraph(
  bytes: ArrayBuffer | Uint8Array | Buffer,
  baseName: string,
  ext: 'xlsx' | 'docx' = 'xlsx',
): Promise<Buffer | null> {
  const config = getSharePointConfig()
  if (!config) return null

  let driveId: string
  try {
    ;({ driveId } = await resolveSiteAndDrive(config))
  } catch (e) {
    console.warn('[SharePoint] PDF変換: ドライブ解決失敗', e)
    return null
  }

  const safeBase = baseName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80)
  const tmpName = `_wf_pdf_tmp/${Date.now()}_${safeBase}.${ext}`
  const encodedTmp = tmpName.split('/').map(encodeURIComponent).join('/')
  const body = bytes instanceof Uint8Array || bytes instanceof Buffer ? bytes : new Uint8Array(bytes)

  // 一時フォルダを用意（存在すれば409無視）
  await ensureFolderPath(driveId, ['_wf_pdf_tmp']).catch(() => {})

  // 1. 一時アップロード
  const upRes = await graphRequest(`/drives/${driveId}/root:/${encodedTmp}:/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: body as unknown as BodyInit,
  })
  if (!upRes.ok) {
    console.warn('[SharePoint] PDF変換: 一時アップロード失敗', upRes.status, await upRes.text())
    return null
  }
  const item = (await upRes.json()) as { id: string }

  // 2. PDF 変換取得（fetch は 302 を自動追従）
  let pdf: Buffer | null = null
  try {
    const pdfRes = await graphRequest(`/drives/${driveId}/items/${item.id}/content?format=pdf`)
    if (pdfRes.ok) {
      pdf = Buffer.from(await pdfRes.arrayBuffer())
    } else {
      console.warn('[SharePoint] PDF変換失敗', pdfRes.status, await pdfRes.text())
    }
  } finally {
    // 3. 一時ファイル削除（失敗は無視）
    await graphRequest(`/drives/${driveId}/items/${item.id}`, { method: 'DELETE' }).catch(() => {})
  }
  return pdf
}

export interface ArchiveMetadata {
  /** 申請番号 (e.g. "APP-2026-0001") */
  applicationNumber: string
  /** 申請者氏名 */
  applicantName: string
  /** 最終承認者氏名 */
  finalApproverName: string | null
  /** 申請日 (ISO date string) */
  submittedAt: string | null
  /** 承認完了日 (ISO date string) */
  approvedAt: string
  /** 全承認者を CSV 形式で連結したもの (例 "課長 山田 / 部長 鈴木") */
  approversTrail: string
  /** 書類種別名 (例 "企画外注向け注文書") */
  documentTypeName: string
}

export interface ArchiveResult {
  webUrl: string
  itemId: string
  driveId: string
}

/**
 * Upload a PDF to SharePoint under the document-type folder and set metadata.
 *
 * @param folderName  document_type.name, used as both the SharePoint folder
 *                    name and the metadata `書類種別` field. Must match an
 *                    existing folder unless SHAREPOINT_AUTO_CREATE_FOLDERS=1.
 */
/**
 * ドライブルート配下に指定パスのフォルダを冪等に作成する。
 * segment 単位で `children` に POST（conflictBehavior=fail、409=既存はスキップ）。
 * SHAREPOINT_AUTO_CREATE_FOLDERS=1 のときのみ archivePdfToSharePoint から呼ばれる。
 */
async function ensureFolderPath(driveId: string, parts: string[]): Promise<void> {
  let parentPath = ''
  for (const seg of parts) {
    const encodedParent = parentPath
      ? parentPath.split('/').map(encodeURIComponent).join('/')
      : ''
    const childrenPath = encodedParent
      ? `/drives/${driveId}/root:/${encodedParent}:/children`
      : `/drives/${driveId}/root/children`
    const res = await graphRequest(childrenPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: seg,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    })
    // 409 = 既に存在（正常）。それ以外の失敗は警告のみ（後続アップロードで検知）。
    if (!res.ok && res.status !== 409) {
      const t = await res.text()
      console.warn(`[SharePoint] フォルダ作成失敗 "${seg}" (${res.status}): ${t}`)
    }
    parentPath = parentPath ? `${parentPath}/${seg}` : seg
  }
}

export async function archivePdfToSharePoint(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  folderName: string,
  metadata: ArchiveMetadata,
): Promise<ArchiveResult> {
  const config = getSharePointConfig()
  if (!config) throw new Error('SharePoint is not configured (SHAREPOINT_HOSTNAME / SHAREPOINT_SITE_PATH)')

  const { driveId, fieldMap } = await resolveSiteAndDrive(config)

  // Build the folder path under the drive root.
  const folderPathParts = [config.rootFolder, folderName].filter(Boolean)
  const folderPath = folderPathParts.join('/')

  // 書類種別フォルダを自動作成（有効時）。新規帳票でも初回申請から格納できる。
  if (config.autoCreateFolders && folderPathParts.length > 0) {
    await ensureFolderPath(driveId, folderPathParts)
  }
  // Drive item path syntax: /drives/{drive-id}/root:/path/to/file:/content
  // We use encodeURIComponent on each segment so Japanese folder names work.
  const encodedFolderPath = folderPathParts.map(encodeURIComponent).join('/')
  const encodedFileName = encodeURIComponent(fileName)

  // ── 1. Upload the file (small file, <4MB, single PUT) ────────────────────
  const uploadPath = encodedFolderPath
    ? `/drives/${driveId}/root:/${encodedFolderPath}/${encodedFileName}:/content`
    : `/drives/${driveId}/root:/${encodedFileName}:/content`

  const bodyBytes = pdfBytes instanceof Uint8Array || pdfBytes instanceof Buffer
    ? pdfBytes
    : new Uint8Array(pdfBytes)

  const doUpload = () => graphRequest(uploadPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: bodyBytes as unknown as BodyInit,
  })

  let uploadRes = await doUpload()

  // フォルダ未作成による 404 は、自動作成が有効なら作成して1度だけ再試行する。
  if (!uploadRes.ok && uploadRes.status === 404 && config.autoCreateFolders && folderPathParts.length > 0) {
    await ensureFolderPath(driveId, folderPathParts)
    uploadRes = await doUpload()
  }

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    if (uploadRes.status === 404) {
      throw new Error(
        `SharePoint フォルダ "${folderPath}" が見つかりません。` +
          `SharePoint側で書類種別名と同じフォルダを作成するか、SHAREPOINT_AUTO_CREATE_FOLDERS=1 を設定してください。 (${text})`,
      )
    }
    throw new Error(`SharePoint アップロード失敗 (${uploadRes.status}): ${text}`)
  }

  const driveItem = (await uploadRes.json()) as {
    id: string
    webUrl: string
    parentReference?: { driveId: string }
  }

  // ── 2. Set list-item metadata fields ─────────────────────────────────────
  // Graph APIの listItem/fields PATCH は表示名ではなく「内部名」を要求する。
  // 日本語列は内部的に URLエンコード形式 (例: _x7533__x8acb__x756a__x53f7_)
  // になっているため、fieldMap で表示名から内部名へ変換する。
  // fieldMap に無い列はライブラリに未追加とみなしスキップ (graceful degradation)。
  const metadataByDisplayName: Record<string, string> = {
    申請番号: metadata.applicationNumber,
    申請者: metadata.applicantName,
    最終承認者: metadata.finalApproverName || '',
    承認者一覧: metadata.approversTrail,
    申請日: metadata.submittedAt || '',
    承認完了日: metadata.approvedAt,
    書類種別: metadata.documentTypeName,
  }
  const fieldUpdates: Record<string, string> = {
    // Title は SharePoint 標準列 (内部名 = 'Title' そのまま) なので変換不要
    Title: metadata.applicationNumber,
  }
  const missingColumns: string[] = []
  for (const [displayName, value] of Object.entries(metadataByDisplayName)) {
    const internalName = fieldMap.get(displayName)
    if (internalName) {
      fieldUpdates[internalName] = value
    } else {
      missingColumns.push(displayName)
    }
  }
  if (missingColumns.length > 0) {
    console.warn(`[SharePoint] 未定義の列をスキップ: ${missingColumns.join(', ')}`)
  }

  const itemId = driveItem.id
  // PATCH /drives/{drive-id}/items/{item-id}/listItem/fields
  const fieldRes = await graphRequest(
    `/drives/${driveId}/items/${itemId}/listItem/fields`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldUpdates),
    },
  )

  // Field update failure is non-fatal — the file is already uploaded, the user
  // can add columns later and re-run archive. We log the error for diagnostics.
  if (!fieldRes.ok) {
    const text = await fieldRes.text()
    console.warn(`[SharePoint] メタデータ設定失敗 (${fieldRes.status}): ${text}`)
  }

  return {
    webUrl: driveItem.webUrl,
    itemId: driveItem.id,
    driveId,
  }
}
