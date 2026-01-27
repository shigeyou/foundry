import { headers } from "next/headers";

export interface UserInfo {
  id: string;
  name: string;
  email?: string;
}

/**
 * Entra ID (Azure AD) Easy Auth からユーザー情報を取得
 * ローカル開発時はデフォルトユーザーを返す
 */
export async function getCurrentUser(): Promise<UserInfo> {
  const headersList = await headers();

  // Azure App Service Easy Auth のヘッダーからユーザー情報を取得
  const principalId = headersList.get("x-ms-client-principal-id");
  const principalName = headersList.get("x-ms-client-principal-name");

  if (principalId && principalName) {
    return {
      id: principalId,
      name: principalName,
      email: principalName.includes("@") ? principalName : undefined,
    };
  }

  // x-ms-client-principal ヘッダーをデコード（より詳細な情報）
  const principalHeader = headersList.get("x-ms-client-principal");
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, "base64").toString("utf-8");
      const principal = JSON.parse(decoded);

      // claims から情報を抽出
      const claims = principal.claims || [];
      const getId = () => {
        const oid = claims.find((c: { typ: string }) => c.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier");
        return oid?.val || principal.userId || "unknown";
      };
      const getName = () => {
        const name = claims.find((c: { typ: string }) => c.typ === "name");
        return name?.val || principal.userDetails || "Unknown User";
      };
      const getEmail = () => {
        const email = claims.find((c: { typ: string }) =>
          c.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" ||
          c.typ === "preferred_username"
        );
        return email?.val;
      };

      return {
        id: getId(),
        name: getName(),
        email: getEmail(),
      };
    } catch {
      // パースエラー時はフォールバック
    }
  }

  // ローカル開発時またはヘッダーがない場合はデフォルトユーザー
  return {
    id: "local-dev-user",
    name: "開発ユーザー",
    email: "dev@localhost",
  };
}

/**
 * ユーザーIDのみを取得（軽量版）
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}
