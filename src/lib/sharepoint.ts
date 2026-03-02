/**
 * SharePoint Graph API クライアント
 *
 * 認証優先順位:
 * 1. Azure Easy Auth (x-ms-token-aad-access-token) - 本番
 * 2. クライアントクレデンシャルフロー (SHAREPOINT_TENANT_ID/CLIENT_ID/CLIENT_SECRET) - 開発/本番
 * 3. 手動トークン (SHAREPOINT_ACCESS_TOKEN) - 開発用フォールバック
 */

import { headers } from "next/headers";

// ─── 型定義 ───

export interface SharePointSite {
  id: string;
  displayName: string;
  webUrl: string;
  description?: string;
}

export interface SharePointDrive {
  id: string;
  name: string;
  driveType: string;
  webUrl: string;
  lastModifiedDateTime?: string;
}

export interface SharePointFile {
  id: string;
  name: string;
  size: number;
  webUrl: string;
  lastModifiedDateTime: string;
  createdDateTime: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
}

export interface SharePointFilesResponse {
  files: SharePointFile[];
  nextLink: string | null;
}

export interface FileSuggestion {
  itemId: string;
  filename: string;
  relevance: "high" | "medium" | "low";
  reason: string;
}

// ─── トークン取得 ───

// クライアントクレデンシャルフローのトークンキャッシュ
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getClientCredentialToken(): Promise<string | null> {
  const tenantId = process.env.SHAREPOINT_TENANT_ID;
  const clientId = process.env.SHAREPOINT_CLIENT_ID;
  const clientSecret = process.env.SHAREPOINT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) return null;

  // キャッシュが有効なら再利用（5分前に期限切れ扱い）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[SharePoint] トークン取得失敗:", res.status, err);
    return null;
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  console.log("[SharePoint] クライアントクレデンシャルトークン取得成功");
  return cachedToken.token;
}

export async function getAccessToken(): Promise<string | null> {
  // 1. Azure Easy Auth ヘッダー（本番）
  try {
    const headersList = await headers();
    const token = headersList.get("x-ms-token-aad-access-token");
    if (token) return token;
  } catch {
    // headers() が使えないコンテキスト（バックグラウンド処理等）
  }

  // 2. クライアントクレデンシャルフロー（アプリ登録）
  const ccToken = await getClientCredentialToken();
  if (ccToken) return ccToken;

  // 3. 手動トークン（ローカル開発フォールバック）
  if (process.env.SHAREPOINT_ACCESS_TOKEN) {
    return process.env.SHAREPOINT_ACCESS_TOKEN;
  }

  return null;
}

// ─── Graph API ラッパー ───

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

interface GraphError {
  error: {
    code: string;
    message: string;
  };
}

export async function graphFetch<T>(path: string, token: string): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphError;
    const msg = body?.error?.message || res.statusText;
    throw new Error(`Graph API ${res.status}: ${msg}`);
  }

  return res.json() as Promise<T>;
}

export async function graphFetchBinary(path: string, token: string): Promise<Buffer> {
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Graph API ${res.status}: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── 公開関数 ───

interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export async function listSites(token: string, search?: string): Promise<SharePointSite[]> {
  const keyword = search || "*";
  let url: string | null = `/sites?search=${encodeURIComponent(keyword)}&$top=100&$select=id,displayName,webUrl,description`;
  const all: SharePointSite[] = [];

  // ページネーションで全件取得（最大500件で打ち止め）
  while (url && all.length < 500) {
    const data = await graphFetch<GraphListResponse<SharePointSite>>(url, token);
    all.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }

  // contentstorage（内部システムサイト）を除外
  return all.filter(s => s.webUrl.indexOf("/contentstorage/") === -1);
}

export async function listDrives(token: string, siteId: string): Promise<SharePointDrive[]> {
  const path = `/sites/${siteId}/drives?$select=id,name,driveType,webUrl,lastModifiedDateTime`;
  const data = await graphFetch<GraphListResponse<SharePointDrive>>(path, token);
  return data.value || [];
}

export async function listFiles(
  token: string,
  driveId: string,
  itemId?: string,
  nextLink?: string
): Promise<SharePointFilesResponse> {
  let path: string;
  if (nextLink) {
    path = nextLink;
  } else if (itemId) {
    path = `/drives/${driveId}/items/${itemId}/children?$top=50&$select=id,name,size,webUrl,lastModifiedDateTime,createdDateTime,folder,file&$orderby=name`;
  } else {
    path = `/drives/${driveId}/root/children?$top=50&$select=id,name,size,webUrl,lastModifiedDateTime,createdDateTime,folder,file&$orderby=name`;
  }

  const data = await graphFetch<GraphListResponse<SharePointFile> & { "@odata.nextLink"?: string }>(path, token);
  return {
    files: data.value || [],
    nextLink: data["@odata.nextLink"] || null,
  };
}

export async function downloadFile(token: string, driveId: string, itemId: string): Promise<Buffer> {
  const path = `/drives/${driveId}/items/${itemId}/content`;
  return graphFetchBinary(path, token);
}
