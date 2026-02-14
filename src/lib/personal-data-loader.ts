// 俺ナビ専用 - 個人情報ローダー
// このファイルはローカル環境でのみ個人情報を読み込む
// Azure環境ではデフォルトの内容が使用される
// 重要: 個人情報ファイルはfoundryリポジトリ外に保存し、Azureにデプロイしない

import { promises as fs } from 'fs';
import path from 'path';

// 個人情報ファイルの場所（foundryリポジトリ外）
// これによりAzureデプロイ時に個人情報が含まれないことを保証
const PERSONAL_DATA_SOURCE = 'C:\\Dev\\kaede_ver10\\agent_docs\\system_prompt';

interface PersonalData {
  profile: string;
  values: string;
  operationModules: string;
  responseRules: string;
}

let cachedData: PersonalData | null = null;
let cacheChecked = false;

async function loadFileIfExists(dir: string, filename: string): Promise<string | null> {
  try {
    const filePath = path.join(dir, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`[PersonalDataLoader] Loaded: ${filename} (${content.length} chars)`);
    return content;
  } catch {
    return null;
  }
}

export async function loadPersonalData(): Promise<PersonalData | null> {
  // キャッシュがあれば返す
  if (cacheChecked) {
    return cachedData;
  }

  // 環境チェック - 本番環境（Azure）では読み込まない
  if (process.env.NODE_ENV === 'production' && process.env.AZURE_WEBAPP_NAME) {
    console.log('[PersonalDataLoader] Azure環境検出 - 個人情報は読み込みません');
    cacheChecked = true;
    return null;
  }

  // ローカルファイルを読み込む（kaede_ver10から直接読み込み）
  console.log(`[PersonalDataLoader] Loading from: ${PERSONAL_DATA_SOURCE}`);

  const profile = await loadFileIfExists(PERSONAL_DATA_SOURCE, 'Myプロフィール.md');
  const values = await loadFileIfExists(PERSONAL_DATA_SOURCE, 'My価値観.md');
  const operationModules = await loadFileIfExists(PERSONAL_DATA_SOURCE, 'My運用モジュール.md');
  const responseRules = await loadFileIfExists(PERSONAL_DATA_SOURCE, 'My回答ルール.md');

  cacheChecked = true;

  // いずれかのファイルが存在すれば読み込み成功
  if (profile || values || operationModules) {
    cachedData = {
      profile: profile || '',
      values: values || '',
      operationModules: operationModules || '',
      responseRules: responseRules || '',
    };
    const totalChars = (cachedData.profile.length + cachedData.values.length +
                        cachedData.operationModules.length + cachedData.responseRules.length);
    console.log(`[PersonalDataLoader] 個人情報を読み込みました (合計 ${totalChars} 文字)`);
    return cachedData;
  }

  console.log('[PersonalDataLoader] 個人情報が見つかりません - デフォルトを使用');
  return null;
}

export function buildPersonalityPrompt(data: PersonalData): string {
  let prompt = '';

  if (data.profile) {
    prompt += `# Myプロフィール（個体条件・身体特性・生活条件・経済状況）\n\n${data.profile}\n\n---\n\n`;
  }

  if (data.values) {
    prompt += `# My価値観（人格OS仕様書）\n\n${data.values}\n\n---\n\n`;
  }

  if (data.operationModules) {
    prompt += `# My運用モジュール（実務プロトコル集）\n\n${data.operationModules}\n\n---\n\n`;
  }

  // 回答ルールは俺ナビ専用システムプロンプトがあるので、エッセンスだけ抽出
  if (data.responseRules) {
    prompt += `# 回答の指針\n\n`;
    prompt += `- すべての回答の判断基準は「ユーザーの人生QOL積分の最大化」\n`;
    prompt += `- 同心円理論：ユーザー本人が中心。優先順位は中心から外側へ下がる\n`;
    prompt += `- 公正世界仮説を踏まえた先回り思考：現実は公正でないことが多い\n`;
    prompt += `- 洞察の深さ：浅い回答禁止、表面的でない具体的なアドバイス\n\n`;
  }

  return prompt;
}
