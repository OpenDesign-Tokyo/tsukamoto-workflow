/**
 * Microsoft Graph API client using client credentials flow.
 * Used for server-side organization sync (users, departments, positions).
 */

interface TokenCache {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

function getGraphConfig() {
  const tenantId = process.env.AZURE_AD_TENANT_ID
  const clientId = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    return null
  }

  return { tenantId, clientId, clientSecret }
}

export function isGraphConfigured(): boolean {
  return getGraphConfig() !== null
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken
  }

  const config = getGraphConfig()
  if (!config) {
    throw new Error('Microsoft Graph API is not configured. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, and AZURE_AD_CLIENT_SECRET.')
  }

  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to get access token: ${res.status} ${text}`)
  }

  const data = await res.json()

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  return data.access_token
}

export interface GraphUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  jobTitle: string | null
  department: string | null
  accountEnabled: boolean
}

export interface GraphManager {
  id: string
  displayName: string
}

async function graphGet<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph API error: ${res.status} ${text}`)
  }

  return res.json()
}

export async function getUsers(): Promise<GraphUser[]> {
  const allUsers: GraphUser[] = []
  let url: string | null = '/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,accountEnabled&$top=999'

  while (url) {
    const data: { value: GraphUser[]; '@odata.nextLink'?: string } = await graphGet(url)
    allUsers.push(...data.value)

    const next = data['@odata.nextLink']
    if (next) {
      // nextLink from Graph is a full URL, strip the base
      url = next.replace('https://graph.microsoft.com/v1.0', '')
    } else {
      url = null
    }
  }

  return allUsers
}

export async function getUserManager(userId: string): Promise<GraphManager | null> {
  try {
    return await graphGet<GraphManager>(`/users/${userId}/manager?$select=id,displayName`)
  } catch {
    // No manager assigned returns 404
    return null
  }
}

export async function testConnection(): Promise<{ connected: boolean; userCount?: number; error?: string }> {
  try {
    const data = await graphGet<{ value: unknown[] }>('/users?$select=id&$top=1')
    return { connected: true, userCount: data.value.length }
  } catch (err) {
    return { connected: false, error: String(err) }
  }
}
