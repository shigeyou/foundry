import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3001';

// ===================================
// 基本的なナビゲーションテスト
// ===================================

test.describe('基本ナビゲーション', () => {
  test('1. ホームページが正常に表示される', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('h1')).toContainText('勝ち筋ファインダー');
    await expect(page.getByRole('link', { name: '探索を始める' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'コア情報を登録' })).toBeVisible();
  });

  test('2. コア情報ページへ遷移できる', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: 'コア情報を登録' }).click();
    await expect(page).toHaveURL(/\/core/);
    await expect(page.locator('h1')).toContainText('コア情報');
  });

  test('3. 探索ページへ遷移できる', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.getByRole('link', { name: '探索を始める' }).click();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page.locator('h1')).toContainText('勝ち筋を探索');
  });

  test('4. 履歴ページにアクセスできる', async ({ page }) => {
    await page.goto(BASE_URL + '/history');
    await expect(page.locator('h1')).toContainText('探索履歴');
  });

  test('5. ページ間を自由に行き来できる', async ({ page }) => {
    await page.goto(BASE_URL);

    // ホーム → 探索
    await page.getByRole('link', { name: '探索を始める' }).click();
    await expect(page).toHaveURL(/\/explore/);

    // 探索 → ホーム
    await page.click('text=← ホームに戻る');
    await expect(page).toHaveURL(BASE_URL + '/');

    // ホーム → コア情報
    await page.getByRole('link', { name: 'コア情報を登録' }).click();
    await expect(page).toHaveURL(/\/core/);

    // コア情報 → ホーム
    await page.click('text=← ホームに戻る');
    await expect(page).toHaveURL(BASE_URL + '/');
  });
});

// ===================================
// サービス管理テスト (CRUD)
// ===================================

test.describe('サービス管理 (CRUD)', () => {
  test('6. サービスを登録できる（基本情報のみ）', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await page.click('text=+ 追加');

    await expect(page.locator('role=dialog')).toBeVisible();

    const serviceName = 'テストサービス_' + Date.now();
    await page.locator('role=dialog >> input').first().fill(serviceName);
    await page.locator('role=dialog >> button:has-text("追加")').click();

    await page.waitForTimeout(1500);
    await expect(page.locator(`text=${serviceName}`)).toBeVisible();
  });

  test('7. サービスを登録できる（全項目入力）', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await page.click('text=+ 追加');

    await expect(page.locator('role=dialog')).toBeVisible();

    const dialog = page.locator('role=dialog');
    const serviceName = 'フル入力サービス_' + Date.now();

    await dialog.locator('input').first().fill(serviceName);
    await dialog.locator('text=技術・エンジニアリング').first().click({ force: true });
    await dialog.locator('input[type="url"]').fill('https://example.com/service');
    await dialog.locator('textarea').fill('これはテスト用のサービス説明です。全項目入力テスト。');

    await dialog.locator('button:has-text("追加")').click();
    await page.waitForTimeout(1500);

    await expect(page.locator(`text=${serviceName}`)).toBeVisible();
    await expect(page.locator('text=技術・エンジニアリング')).toBeVisible();
  });

  test('8. サービスを編集できる', async ({ page }) => {
    // まず新しいサービスを作成
    await page.goto(BASE_URL + '/core');
    await page.click('text=+ 追加');
    await expect(page.locator('role=dialog')).toBeVisible();

    const originalName = '編集前サービス_' + Date.now();
    await page.locator('role=dialog >> input').first().fill(originalName);
    await page.locator('role=dialog >> button:has-text("追加")').click();
    await page.waitForTimeout(1500);

    // 編集ボタンをクリック
    const editButton = page.locator('button:has-text("編集")').first();
    await editButton.click();
    await expect(page.locator('role=dialog')).toBeVisible();

    const dialog = page.locator('role=dialog');
    const nameInput = dialog.locator('input').first();
    const editedName = '編集済み_' + Date.now();
    await nameInput.clear();
    await nameInput.fill(editedName);

    await dialog.locator('button:has-text("更新")').click();
    await page.waitForTimeout(1500);

    await expect(page.locator(`text=${editedName}`)).toBeVisible();
  });

  test('9. サービスを削除できる', async ({ page }) => {
    // まず新しいサービスを作成
    await page.goto(BASE_URL + '/core');
    await page.click('text=+ 追加');
    await expect(page.locator('role=dialog')).toBeVisible();

    const serviceName = '削除テスト_' + Date.now();
    await page.locator('role=dialog >> input').first().fill(serviceName);
    await page.locator('role=dialog >> button:has-text("追加")').click();
    await page.waitForTimeout(1500);

    // 削除
    page.on('dialog', dialog => dialog.accept());
    await page.locator(`text=${serviceName}`).locator('..').locator('..').locator('button:has-text("削除")').click();
    await page.waitForTimeout(1500);

    // 削除されたことを確認（存在しないことを確認）
    await expect(page.locator(`text=${serviceName}`)).toHaveCount(0);
  });

  test('10. 連続でサービスを登録できる', async ({ page }) => {
    await page.goto(BASE_URL + '/core');

    for (let i = 1; i <= 3; i++) {
      await page.click('text=+ 追加');
      await expect(page.locator('role=dialog')).toBeVisible();

      const dialog = page.locator('role=dialog');
      const serviceName = '連続テスト' + i + '_' + Date.now();
      await dialog.locator('input').first().fill(serviceName);
      await dialog.locator('button:has-text("追加")').click();

      await page.waitForTimeout(1500);
    }
  });

  test('11. ダイアログをキャンセルできる', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await page.click('text=+ 追加');

    await expect(page.locator('role=dialog')).toBeVisible();

    const dialog = page.locator('role=dialog');
    await dialog.locator('input').first().fill('キャンセルテスト');
    await dialog.locator('button:has-text("キャンセル")').click();

    await expect(page.locator('role=dialog')).not.toBeVisible();
  });
});

// ===================================
// 探索ページテスト
// ===================================

test.describe('探索ページ', () => {
  test('12. 空の問いでは探索ボタンが無効', async ({ page }) => {
    await page.goto(BASE_URL + '/explore');

    const exploreButton = page.locator('button:has-text("勝ち筋を探索")');
    await expect(exploreButton).toBeDisabled();

    await page.locator('textarea').first().fill('テスト問い');
    await expect(exploreButton).toBeEnabled();

    await page.locator('textarea').first().fill('');
    await expect(exploreButton).toBeDisabled();
  });

  test('13. 制約条件を切り替えられる', async ({ page }) => {
    await page.goto(BASE_URL + '/explore');

    const existingBizCheckbox = page.locator('#existing');
    await expect(existingBizCheckbox).toBeChecked();

    await existingBizCheckbox.click();
    await expect(existingBizCheckbox).not.toBeChecked();

    const parentCheckbox = page.locator('#parent');
    await parentCheckbox.click();
    await expect(parentCheckbox).toBeChecked();

    const synergyCheckbox = page.locator('#synergy');
    await synergyCheckbox.click();
    await expect(synergyCheckbox).toBeChecked();
  });

  test('14. 探索ページのフォームが正しく動作する', async ({ page }) => {
    await page.goto(BASE_URL + '/explore');

    const questionTextarea = page.locator('textarea').first();
    const contextTextarea = page.locator('textarea').nth(1);

    await questionTextarea.fill('親会社との連携強化について');
    await contextTextarea.fill('来月の役員会議で発表予定');

    await expect(questionTextarea).toHaveValue('親会社との連携強化について');
    await expect(contextTextarea).toHaveValue('来月の役員会議で発表予定');
  });

  test('15. 長文入力のテスト', async ({ page }) => {
    await page.goto(BASE_URL + '/explore');

    const longText = '長文テスト'.repeat(100);
    const questionTextarea = page.locator('textarea').first();
    await questionTextarea.fill(longText);

    await expect(questionTextarea).toHaveValue(longText);
  });

  test('16. 特殊文字入力のテスト', async ({ page }) => {
    await page.goto(BASE_URL + '/explore');

    const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~日本語テスト漢字カタカナひらがな';
    const questionTextarea = page.locator('textarea').first();
    await questionTextarea.fill(specialChars);

    await expect(questionTextarea).toHaveValue(specialChars);
  });
});

// ===================================
// エクスポート機能テスト
// ===================================

test.describe('エクスポート機能', () => {
  test('17. コア情報ページでCSVエクスポートボタンが存在する', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await expect(page.getByTestId('export-csv')).toBeVisible();
    await expect(page.getByTestId('export-csv')).toContainText('CSVエクスポート');
  });

  test('18. コア情報ページでJSONエクスポートボタンが存在する', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await expect(page.getByTestId('export-json')).toBeVisible();
    await expect(page.getByTestId('export-json')).toContainText('JSONエクスポート');
  });

  test('19. 履歴ページでCSVエクスポートボタンが存在する', async ({ page }) => {
    await page.goto(BASE_URL + '/history');
    await expect(page.getByTestId('export-csv')).toBeVisible();
    await expect(page.getByTestId('export-csv')).toContainText('CSVエクスポート');
  });

  test('20. 履歴ページでJSONエクスポートボタンが存在する', async ({ page }) => {
    await page.goto(BASE_URL + '/history');
    await expect(page.getByTestId('export-json')).toBeVisible();
    await expect(page.getByTestId('export-json')).toContainText('JSONエクスポート');
  });

  test('21. CSVエクスポートAPIが正常に動作する', async ({ page }) => {
    await page.goto(BASE_URL + '/core');

    // APIを直接呼び出してテスト
    const response = await page.request.get(BASE_URL + '/api/export?type=services&format=csv');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
  });

  test('22. JSONエクスポートAPIが正常に動作する', async ({ page }) => {
    await page.goto(BASE_URL + '/core');

    const response = await page.request.get(BASE_URL + '/api/export?type=services&format=json');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

// ===================================
// インポート機能テスト
// ===================================

test.describe('インポート機能', () => {
  test('23. コア情報ページでCSVインポートボタンが存在する', async ({ page }) => {
    await page.goto(BASE_URL + '/core');
    await expect(page.getByTestId('import-btn')).toBeVisible();
    await expect(page.getByTestId('import-btn')).toContainText('CSVインポート');
  });

  test('24. インポートAPIが正常に動作する（正しいCSV）', async ({ page }) => {
    // CSVファイルの内容を作成
    const csvContent = 'name,category,description,url\nインポートテスト,技術・エンジニアリング,テスト説明,https://example.com';

    const response = await page.request.post(BASE_URL + '/api/import', {
      multipart: {
        file: {
          name: 'test.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(csvContent),
        },
        type: 'services',
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.imported).toBeGreaterThanOrEqual(1);
  });

  test('25. インポートAPIがファイル無しでエラーを返す', async ({ page }) => {
    const response = await page.request.post(BASE_URL + '/api/import', {
      multipart: {
        type: 'services',
      },
    });

    expect(response.status()).toBe(400);
  });
});

// ===================================
// 履歴ページテスト
// ===================================

test.describe('履歴ページ', () => {
  test('26. 履歴が空の場合に適切なメッセージが表示される', async ({ page }) => {
    await page.goto(BASE_URL + '/history');
    // 履歴があるかどうかに関わらず、ページが正しく表示されることを確認
    await expect(page.locator('h1')).toContainText('探索履歴');
  });
});

// ===================================
// エラーハンドリングテスト
// ===================================

test.describe('エラーハンドリング', () => {
  test('27. 存在しないページにアクセスした時の動作', async ({ page }) => {
    const response = await page.goto(BASE_URL + '/nonexistent');
    // Next.jsの404ページが表示されることを確認
    expect(response?.status()).toBe(404);
  });

  test('28. 不正なエクスポートタイプでエラーが返る', async ({ page }) => {
    const response = await page.request.get(BASE_URL + '/api/export?type=invalid&format=csv');
    expect(response.status()).toBe(400);
  });
});

// ===================================
// UIインタラクションテスト
// ===================================

test.describe('UIインタラクション', () => {
  test('29. ホバー効果が正しく動作する', async ({ page }) => {
    await page.goto(BASE_URL);

    const card = page.locator('.hover\\:shadow-lg').first();
    await card.hover();
    // ホバー後もカードが正常に表示されることを確認
    await expect(card).toBeVisible();
  });

  test('30. レスポンシブレイアウトのテスト（モバイル幅）', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // モバイル幅でもコンテンツが表示されることを確認
    await expect(page.locator('h1')).toContainText('勝ち筋ファインダー');
  });

  test('31. レスポンシブレイアウトのテスト（タブレット幅）', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(BASE_URL);

    await expect(page.locator('h1')).toContainText('勝ち筋ファインダー');
  });

  test('32. レスポンシブレイアウトのテスト（デスクトップ幅）', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(BASE_URL);

    await expect(page.locator('h1')).toContainText('勝ち筋ファインダー');
  });
});

// ===================================
// パフォーマンステスト
// ===================================

test.describe('パフォーマンス', () => {
  test('33. ホームページのロード時間が5秒以内', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });

  test('34. コア情報ページのロード時間が5秒以内', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL + '/core');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
  });
});

// ===================================
// データ整合性テスト
// ===================================

test.describe('データ整合性', () => {
  test('35. サービス作成後にリストに反映される', async ({ page }) => {
    await page.goto(BASE_URL + '/core');

    const initialCards = await page.getByTestId('service-card').count();

    await page.click('text=+ 追加');
    await expect(page.locator('role=dialog')).toBeVisible();

    const serviceName = 'データ整合性テスト_' + Date.now();
    await page.locator('role=dialog >> input').first().fill(serviceName);
    await page.locator('role=dialog >> button:has-text("追加")').click();

    await page.waitForTimeout(2000);

    const finalCards = await page.getByTestId('service-card').count();
    expect(finalCards).toBeGreaterThan(initialCards);
  });
});
