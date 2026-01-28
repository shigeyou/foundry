import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../.auth/azure-user.json');

setup('Azure AD認証', async ({ page }) => {
  // 認証ファイルが存在し、24時間以内に作成されていればスキップ
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile);
    const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

    if (ageHours < 24) {
      console.log(`認証ファイルが存在します（${ageHours.toFixed(1)}時間前）- 再利用`);

      // 認証状態をロードして有効性を確認
      await page.context().addCookies([]);  // コンテキスト初期化
      const storageState = JSON.parse(fs.readFileSync(authFile, 'utf-8'));

      // クッキーがあれば有効と判断
      if (storageState.cookies && storageState.cookies.length > 0) {
        console.log('認証状態を再利用します');
        return;  // 認証スキップ
      }
    }
  }

  console.log('Starting Azure AD authentication...');

  // Azureアプリにアクセス
  await page.goto('https://kachisuji-finder.azurewebsites.net/', { timeout: 60000 });

  // ログインページにリダイレクトされた場合
  if (page.url().includes('login.microsoftonline.com') || page.url().includes('login.live.com')) {
    console.log('Login page detected. Waiting for manual authentication...');
    console.log('Please complete the login in the browser window.');

    // アプリにリダイレクトされるまで待機（最大3分）
    console.log('>>> ブラウザでログインを完了してください <<<');
    await page.waitForURL((url) => url.href.includes('kachisuji-finder.azurewebsites.net') && !url.href.includes('login'), {
      timeout: 180000,
    });

    console.log('Authentication successful!');
  }

  // アプリが表示されることを確認
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();

  console.log('App loaded. Saving authentication state...');

  // 認証状態を保存
  await page.context().storageState({ path: authFile });

  console.log('Authentication state saved to:', authFile);
});
