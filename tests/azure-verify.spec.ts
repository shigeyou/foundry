import { test, expect } from '@playwright/test';

const AZURE_URL = 'https://kachisuji-finder.azurewebsites.net';

// 認証状態を使用
test.use({ storageState: '.auth/azure-user.json' });

test.describe('Azure環境バグ修正確認', () => {
  test.setTimeout(120000);

  test('SD-003: SWOTボタン連打防止確認', async ({ page }) => {
    // 認証状態でAzureにアクセス
    await page.goto(AZURE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // SWOTタブに移動
    const swotTab = page.locator('button:has-text("SWOT")');
    await swotTab.click();
    await page.waitForTimeout(2000);

    // 再分析ボタンを探す
    const reanalyzeButton = page.locator('button:has-text("再分析"), button:has-text("分析開始"), button:has-text("分析中")').first();

    if (await reanalyzeButton.isVisible()) {
      const initialText = await reanalyzeButton.textContent();
      console.log(`初期ボタンテキスト: ${initialText}`);

      // 「分析中...」の場合は既に実行中なのでスキップ
      if (initialText?.includes('分析中')) {
        console.log('既に分析中のため、ボタンは無効化状態');
        const isDisabled = await reanalyzeButton.isDisabled();
        expect(isDisabled).toBe(true);
        console.log('✅ SD-003: ボタン連打防止が有効（実行中状態）');
        return;
      }

      // 1回目クリック
      await reanalyzeButton.click();
      console.log('1回目クリック: 送信');

      // すぐにボタンの状態を確認（100ms以内に変わるはず）
      await page.waitForTimeout(100);

      // ボタンが無効化されているか、またはテキストが「分析中...」に変わっているか確認
      const buttonAfterClick = page.locator('button:has-text("再分析"), button:has-text("分析中")').first();
      const textAfterClick = await buttonAfterClick.textContent();
      const isDisabled = await buttonAfterClick.isDisabled().catch(() => false);

      console.log(`クリック後のテキスト: ${textAfterClick}`);
      console.log(`ボタン無効化状態: ${isDisabled}`);

      // SD-003修正: ボタンが無効化されているか、テキストが変わっているか
      const isProtected = isDisabled || textAfterClick?.includes('分析中');
      expect(isProtected).toBe(true);
      console.log('✅ SD-003: ボタン連打防止が有効');
    } else {
      console.log('再分析ボタンが見つかりません（SWOT未実行の可能性）');
    }
  });

  test('SD-008: タブ切替後の入力保持確認', async ({ page }) => {
    await page.goto(AZURE_URL);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 勝ち筋探索タブに移動
    const exploreTab = page.locator('button:has-text("勝ち筋探索")');
    await exploreTab.click();
    await page.waitForTimeout(2000);

    // テキストエリアに入力
    const textarea = page.locator('textarea').first();
    const testInput = 'Azure環境テスト入力 - ' + Date.now();

    if (await textarea.isVisible()) {
      await textarea.fill(testInput);
      console.log(`入力: "${testInput}"`);

      // 別タブに移動
      const swotTab = page.locator('button:has-text("SWOT")');
      await swotTab.click();
      await page.waitForTimeout(1000);
      console.log('SWOTタブに移動');

      // 勝ち筋探索タブに戻る
      await exploreTab.click();
      await page.waitForTimeout(1000);
      console.log('勝ち筋探索タブに戻る');

      // 入力が保持されているか確認
      const preservedValue = await textarea.inputValue();
      console.log(`保持された値: "${preservedValue}"`);

      const isPreserved = preservedValue === testInput;
      console.log(`入力保持: ${isPreserved}`);

      expect(isPreserved).toBe(true);
      console.log('✅ SD-008: 入力保持が有効');
    } else {
      console.log('テキストエリアが見つかりません');
    }
  });
});
