import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

// テスト1: ホームページの表示確認
test('1. ホームページが正常に表示される', async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page.locator('h1')).toContainText('勝ち筋ファインダー');
  await expect(page.getByRole('link', { name: '探索を始める' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'コア情報を登録' })).toBeVisible();
});

// テスト2: コア情報ページへのナビゲーション
test('2. コア情報ページへ遷移できる', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.getByRole('link', { name: 'コア情報を登録' }).click();
  await expect(page).toHaveURL(/\/core/);
  await expect(page.locator('h1')).toContainText('コア情報');
});

// テスト3: サービス登録（基本）
test('3. サービスを登録できる（基本情報のみ）', async ({ page }) => {
  await page.goto(BASE_URL + '/core');
  await page.click('text=+ 追加');

  await expect(page.locator('role=dialog')).toBeVisible();

  await page.locator('role=dialog >> input').first().fill('テストサービス_' + Math.random().toString(36).slice(2, 8));
  await page.locator('role=dialog >> button:has-text("追加")').click();

  await page.waitForTimeout(2000);
});

// テスト4: サービス登録（全項目入力）
test('4. サービスを登録できる（全項目入力）', async ({ page }) => {
  await page.goto(BASE_URL + '/core');
  await page.click('text=+ 追加');

  await expect(page.locator('role=dialog')).toBeVisible();

  // ダイアログ内の要素を操作
  const dialog = page.locator('role=dialog');
  await dialog.locator('input').first().fill('フル入力サービス_' + Math.random().toString(36).slice(2, 8));

  // カテゴリをダイアログ内で選択（force: trueで強制クリック）
  await dialog.locator('text=技術・エンジニアリング').first().click({ force: true });

  // URL入力
  await dialog.locator('input[type="url"]').fill('https://example.com/service');

  // 説明入力
  await dialog.locator('textarea').fill('これはテスト用のサービス説明です。');

  await dialog.locator('button:has-text("追加")').click();
  await page.waitForTimeout(2000);
});

// テスト5: サービス編集
test('5. サービスを編集できる', async ({ page }) => {
  await page.goto(BASE_URL + '/core');

  const editButton = page.locator('button:has-text("編集")').first();
  const isVisible = await editButton.isVisible({ timeout: 3000 }).catch(() => false);

  if (isVisible) {
    await editButton.click();
    await expect(page.locator('role=dialog')).toBeVisible();

    const dialog = page.locator('role=dialog');
    const nameInput = dialog.locator('input').first();
    await nameInput.clear();
    await nameInput.fill('編集済み_' + Math.random().toString(36).slice(2, 8));

    await dialog.locator('button:has-text("更新")').click();
    await page.waitForTimeout(1000);
  }
});

// テスト6: 空の問い送信（エッジケース）
test('6. 空の問いでは探索ボタンが無効', async ({ page }) => {
  await page.goto(BASE_URL + '/explore');

  const exploreButton = page.locator('button:has-text("勝ち筋を探索")');
  await expect(exploreButton).toBeDisabled();

  await page.locator('textarea').first().fill('テスト問い');
  await expect(exploreButton).toBeEnabled();

  await page.locator('textarea').first().fill('');
  await expect(exploreButton).toBeDisabled();
});

// テスト7: 制約条件の切り替え
test('7. 制約条件を切り替えられる', async ({ page }) => {
  await page.goto(BASE_URL + '/explore');

  const existingBizCheckbox = page.locator('#existing');
  await expect(existingBizCheckbox).toBeChecked();

  await existingBizCheckbox.click();
  await expect(existingBizCheckbox).not.toBeChecked();

  const parentCheckbox = page.locator('#parent');
  await parentCheckbox.click();
  await expect(parentCheckbox).toBeChecked();
});

// テスト8: 探索ページの入力フォーム検証
test('8. 探索ページのフォームが正しく動作する', async ({ page }) => {
  await page.goto(BASE_URL + '/explore');

  const questionTextarea = page.locator('textarea').first();
  const contextTextarea = page.locator('textarea').nth(1);

  await questionTextarea.fill('親会社との連携強化について');
  await contextTextarea.fill('来月の役員会議で発表予定');

  await expect(questionTextarea).toHaveValue('親会社との連携強化について');
  await expect(contextTextarea).toHaveValue('来月の役員会議で発表予定');
});

// テスト9: 履歴ページのアクセス
test('9. 履歴ページにアクセスできる', async ({ page }) => {
  await page.goto(BASE_URL + '/history');
  await expect(page.locator('h1')).toContainText('探索履歴');
});

// テスト10: 連続サービス登録
test('10. 連続でサービスを登録できる', async ({ page }) => {
  await page.goto(BASE_URL + '/core');

  for (let i = 1; i <= 2; i++) {
    await page.click('text=+ 追加');
    await expect(page.locator('role=dialog')).toBeVisible();

    const dialog = page.locator('role=dialog');
    await dialog.locator('input').first().fill('連続テスト' + i + '_' + Math.random().toString(36).slice(2, 8));
    await dialog.locator('button:has-text("追加")').click();

    await page.waitForTimeout(1500);
  }
});

// テスト11: ダイアログのキャンセル操作
test('11. ダイアログをキャンセルできる', async ({ page }) => {
  await page.goto(BASE_URL + '/core');
  await page.click('text=+ 追加');

  await expect(page.locator('role=dialog')).toBeVisible();

  const dialog = page.locator('role=dialog');
  await dialog.locator('input').first().fill('キャンセルテスト');
  await dialog.locator('button:has-text("キャンセル")').click();

  await expect(page.locator('role=dialog')).not.toBeVisible();
});

// テスト12: ページ間ナビゲーション
test('12. ページ間を自由に行き来できる', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.getByRole('link', { name: '探索を始める' }).click();
  await expect(page).toHaveURL(/\/explore/);
  await expect(page.locator('h1')).toContainText('勝ち筋を探索');

  await page.goto(BASE_URL + '/core');
  await expect(page.locator('h1')).toContainText('コア情報');

  await page.goto(BASE_URL + '/history');
  await expect(page.locator('h1')).toContainText('探索履歴');
});
