# E2E Tests for Auto Tagger

このディレクトリには、Auto Tagger機能のエンドツーエンド（E2E）テストが含まれています。

## 概要

E2Eテストは、実際のObsidian環境でAuto Tagger機能が正しく動作することを検証します。Playwrightを使用してElectronアプリケーションを自動化し、ユーザーの実際の操作をシミュレートします。

## テストファイル

### 統合テスト
- **`autoTagger.spec.ts`** - AutoTaggerサービスの統合テスト
  - バッチ処理の検証
  - 停止機能のテスト
  - エラーハンドリングのテスト
  - タグ適用の検証
  - 状態管理のテスト

### E2Eユーザージャーニーテスト
- **`autoTagger.e2e.spec.ts`** - ユーザージャーニーベースのE2Eテスト
  - TC-E2E-001: 初回セットアップフロー
  - TC-E2E-002: 日常的な使用フロー
  - TC-E2E-003: 大規模プロジェクトの一括タグ付け
  - TC-E2E-004: エラーリカバリーフロー
  - TC-E2E-005: カスタマイズフロー
  - TC-E2E-006: マルチセッションフロー

## セットアップ

### 前提条件

1. Node.js (v18以上)
2. pnpm
3. Obsidian（テスト用）

### インストール

```bash
# 依存関係のインストール
pnpm install

# Playwrightのインストール
pnpm exec playwright install
```

### E2E環境のセットアップ

```bash
# プラグインをビルド
pnpm build

# E2E環境をセットアップ
pnpm run e2e-setup
```

## テストの実行

### 環境変数の設定

E2Eテストを実行する前に、Gemini API keyを環境変数に設定してください：

**Windows (PowerShell)**:
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
```

**Windows (CMD)**:
```cmd
set GEMINI_API_KEY=your-api-key-here
```

**Mac/Linux**:
```bash
export GEMINI_API_KEY=your-api-key-here
```

または、`.env`ファイルを作成：
```
GEMINI_API_KEY=your-api-key-here
```

**注意**: API keyが設定されていない場合、API呼び出しが必要なテストは自動的にスキップされます。

### 全テストを実行

```bash
pnpm test:e2e
```

### 特定のテストファイルを実行

```bash
# 統合テスト
pnpm playwright test e2e/specs/autoTagger.spec.ts

# E2Eユーザージャーニーテスト
pnpm playwright test e2e/specs/autoTagger.e2e.spec.ts
```

### 特定のテストケースを実行

```bash
# テスト名で絞り込み
pnpm playwright test -g "TC-E2E-001"

# 初回セットアップフローのみ
pnpm playwright test -g "Initial setup"
```

### デバッグモード

```bash
# UIモードで実行
pnpm playwright test --ui

# デバッグモードで実行
pnpm test:e2e:debug

# ヘッドフルモードで実行（ブラウザを表示）
pnpm playwright test --headed
```

### 特定のブラウザで実行

```bash
# Chromiumのみ
pnpm playwright test --project=chromium
```

## テスト構造

### ディレクトリ構成

```
e2e/
├── specs/                      # テストファイル
│   ├── autoTagger.spec.ts     # 統合テスト
│   └── autoTagger.e2e.spec.ts # E2Eユーザージャーニーテスト
├── helpers/                    # ヘルパークラス
│   ├── AutoTaggerPageObject.ts # AutoTagger専用Page Object
│   ├── ObsidianPageObject.ts   # Obsidian共通Page Object
│   └── types.ts                # 型定義
├── setup/                      # セットアップスクリプト
│   ├── ObsidianTestSetup.ts   # Obsidian起動・設定
│   └── logger-setup.ts         # ロガー設定
├── vault/                      # テスト用Vault
├── base.ts                     # テストベース設定
├── constants.ts                # 定数定義
└── README.md                   # このファイル
```

### Page Object Pattern

テストでは、Page Objectパターンを使用してUIとの相互作用を抽象化しています。

```typescript
import { AutoTaggerPageObject } from "../helpers/AutoTaggerPageObject";

test("example test", async ({ vault }) => {
  const atPage = new AutoTaggerPageObject(
    vault.window,
    vault.pluginHandleMap
  );

  // ノートを作成
  await atPage.writeFile("test.md", "# Test Note");

  // AutoTaggerを実行
  await atPage.runAutoTaggerDirectly(PLUGIN_ID, "");

  // 結果を検証
  await atPage.expectNoteHasTags("test.md");
});
```

## テストシナリオ

### TC-E2E-001: 初回セットアップフロー

**目的**: 新規ユーザーが初めてAuto Taggerを使用する完全なフローを検証

**ステップ**:
1. プラグインが有効化されていることを確認
2. テスト用のノートを作成
3. AutoTaggerを実行
4. 結果を検証
5. ノートにタグが追加されたことを確認

**所要時間**: 約20秒

### TC-E2E-002: 日常的な使用フロー

**目的**: 定期的にノートにタグを付ける日常的なワークフローを検証

**ステップ**:
1. 既存のノート（processed タグ付き）を作成
2. 新しいノートを作成
3. AutoTaggerを実行（processed タグで除外）
4. 新しいノートのみが処理されることを確認

**所要時間**: 約15秒

### TC-E2E-003: 大規模プロジェクトの一括タグ付け

**目的**: 大量のノート（30件）を一括処理するフローを検証

**ステップ**:
1. 30件のノートを作成
2. 処理時間を計測しながら実行
3. バッチ処理が正しく動作することを確認
4. パフォーマンスを検証

**所要時間**: 約30-60秒

### TC-E2E-004: エラーリカバリーフロー

**目的**: エラーが発生した場合の適切な対処を検証

**ステップ**:
1. テストノートを作成
2. 無効なAPI keyでエラーを発生させる
3. エラーが適切に処理されることを確認
4. 正しい設定で再実行
5. 再実行が成功することを確認

**所要時間**: 約20秒

### TC-E2E-005: カスタマイズフロー

**目的**: System Instructionのカスタマイズ効果を検証

**ステップ**:
1. テストノートを作成
2. デフォルト設定で実行
3. カスタムSystem Instructionを設定
4. 再実行してカスタマイズの効果を確認

**所要時間**: 約25秒

### TC-E2E-006: マルチセッションフロー

**目的**: 複数回に分けた段階的な処理を検証

**ステップ**:
1. 3つのフォルダに分けてノートを作成
2. セッション1: 最初のフォルダを処理
3. セッション2: 2番目のフォルダを処理
4. セッション3: 3番目のフォルダを処理
5. 全体の確認

**所要時間**: 約30秒

## トラブルシューティング

### テストが失敗する

1. **プラグインがビルドされていない**
   ```bash
   pnpm build
   ```

2. **E2E環境がセットアップされていない**
   ```bash
   pnpm run e2e-setup
   ```

3. **Obsidianが起動しない**
   - `e2e/.obsidian-unpacked/` ディレクトリが存在するか確認
   - Electronがインストールされているか確認

### テストがタイムアウトする

- `playwright.config.ts` でタイムアウトを増やす
- ネットワーク接続を確認（Gemini API呼び出しが必要）

### ログを確認したい

```bash
# デバッグログを有効化
pnpm test:e2e:debug

# または環境変数を設定
DEBUG=pw:api pnpm test:e2e
```

## CI/CD

### GitHub Actions

`.github/workflows/e2e.yml` でCI/CDパイプラインが設定されています。

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
```

## ベストプラクティス

### 1. テストの独立性

各テストは独立して実行できるようにし、他のテストに依存しないようにします。

```typescript
test("independent test", async ({ vault }) => {
  // テストデータを作成
  await atPage.writeFile("test.md", "content");

  // テストを実行
  // ...

  // クリーンアップ
  await atPage.deleteFile("test.md");
});
```

### 2. Page Objectの使用

UIとの相互作用はPage Objectを通じて行います。

```typescript
// Good
await atPage.clickStart();

// Bad
await vault.window.locator('button:has-text("開始")').click();
```

### 3. 適切な待機

非同期処理には適切な待機を使用します。

```typescript
// Good
await atPage.waitForProcessingComplete();

// Bad
await vault.window.waitForTimeout(5000);
```

### 4. クリーンアップ

テスト後は必ずクリーンアップを行います。

```typescript
test("with cleanup", async ({ vault }) => {
  const paths = await atPage.createTestNotes(5, "test", (i) => `Note ${i}`);

  // テスト実行
  // ...

  // クリーンアップ
  await atPage.deleteTestNotes(paths);
});
```

## 参考資料

- [Playwright Documentation](https://playwright.dev/)
- [Obsidian API Documentation](https://docs.obsidian.md/Home)
- [E2E Test Plan](../.kiro/specs/auto-tag-gemini/e2e-test-plan.md)
- [E2E Test Scenarios](../.kiro/specs/auto-tag-gemini/e2e-test-scenarios.md)

## 貢献

新しいテストを追加する場合:

1. 適切なテストファイルを選択（統合テスト vs E2Eテスト）
2. Page Objectパターンに従う
3. テストの独立性を保つ
4. 適切なクリーンアップを実装
5. ドキュメントを更新

## ライセンス

MIT
