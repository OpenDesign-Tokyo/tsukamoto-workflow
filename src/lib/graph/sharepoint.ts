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
}

export function getSharePointConfig(): SharePointConfig | null {
  const hostname = process.env.SHAREPOINT_HOSTNAME
  const sitePath = process.env.SHAREPOINT_SITE_PATH
  if (!hostname || !sitePath) return null
  return {
    hostname,
    sitePath,
    rootFolder: process.env.SHAREPOINT_ROOT_FOLDER || '',
  }
}

export function isSharePointConfigured(): boolean {
  return isGraphConfigured() && getSharePointConfig() !== null
}

// ── Site / Drive resolution (cached for the lifetime of the lambda) ──────────

interface SiteCache {
  siteId: string
  driveId: string
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

async function resolveSiteAndDrive(config: SharePointConfig): Promise<{ siteId: string; driveId: string }> {
  if (siteCache && Date.now() - siteCache.fetchedAt < SITE_CACHE_TTL_MS) {
    return { siteId: siteCache.siteId, driveId: siteCache.driveId }
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

  siteCache = { siteId: site.id, driveId: drive.id, fetchedAt: Date.now() }
  return { siteId: site.id, driveId: drive.id }
}

/** Test seam: clear in-memory site cache. Used by unit tests and force-refresh paths. */
export function __resetSharePointCacheForTests() {
  siteCache = null
}

// ── Public API ──────────────────────────────────────────────────────────────

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
export async function archivePdfToSharePoint(
  pdfBytes: ArrayBuffer | Uint8Array | Buffer,
  fileName: string,
  folderName: string,
  metadata: ArchiveMetadata,
): Promise<ArchiveResult> {
  const config = getSharePointConfig()
  if (!config) throw new Error('SharePoint is not configured (SHAREPOINT_HOSTNAME / SHAREPOINT_SITE_PATH)')

  const { driveId } = await resolveSiteAndDrive(config)

  // Build the folder path under the drive root.
  const folderPathParts = [config.rootFolder, folderName].filter(Boolean)
  const folderPath = folderPathParts.join('/')
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

  const uploadRes = await graphRequest(uploadPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: bodyBytes as unknown as BodyInit,
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text()
    if (uploadRes.status === 404) {
      throw new Error(
        `SharePoint フォルダ "${folderPath}" が見つかりません。` +
          `SharePoint側で書類種別名と同じフォルダを作成してください。 (${text})`,
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
  // SharePoint internal field names default to display-name-with-special-chars stripped.
  // We try the most-likely internal names and silently skip fields that aren't on
  // the library yet (lets users add columns incrementally without breaking upload).
  const fieldUpdates: Record<string, string> = {
    Title: metadata.applicationNumber,
    申請番号: metadata.applicationNumber,
    申請者: metadata.applicantName,
    最終承認者: metadata.finalApproverName || '',
    承認者一覧: metadata.approversTrail,
    申請日: metadata.submittedAt || '',
    承認完了日: metadata.approvedAt,
    書類種別: metadata.documentTypeName,
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
