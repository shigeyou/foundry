import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/azure-user.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 180000, // 3分タイムアウト（認証用）

  projects: [
    // 認証セットアップ（最初に実行）
    {
      name: 'azure-auth',
      testMatch: /azure-auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false, // 認証のため有頭モードで実行
      },
    },
    // Azure E2Eテスト（認証後に実行）
    {
      name: 'azure-e2e',
      testMatch: /azure-e2e\.spec\.ts/,
      dependencies: ['azure-auth'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: authFile,
        baseURL: 'https://kachisuji-finder.azurewebsites.net',
      },
    },
    // ワークフロー包括テスト（認証後に実行）
    {
      name: 'azure-workflow',
      testMatch: /azure-workflow\.spec\.ts/,
      dependencies: ['azure-auth'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: authFile,
        baseURL: 'https://kachisuji-finder.azurewebsites.net',
      },
    },
    // データ永続化テスト（認証後に実行）
    {
      name: 'azure-persistence',
      testMatch: /azure-persistence\.spec\.ts/,
      dependencies: ['azure-auth'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: authFile,
        baseURL: 'https://kachisuji-finder.azurewebsites.net',
      },
    },
    // 共通データ作成テスト（認証後に実行）
    {
      name: 'azure-setup-data',
      testMatch: /azure-setup-data\.spec\.ts/,
      dependencies: ['azure-auth'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: authFile,
        baseURL: 'https://kachisuji-finder.azurewebsites.net',
      },
    },
    // 包括的ストレステスト（認証後に実行）
    {
      name: 'azure-stress',
      testMatch: /comprehensive-stress\.spec\.ts/,
      dependencies: ['azure-auth'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: authFile,
        baseURL: 'https://kachisuji-finder.azurewebsites.net',
      },
    },
  ],
});
