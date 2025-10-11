# E2Eテスト実行ガイド

## 🚀 クイックスタート

### 1. API Keyの設定

E2Eテストを実行するには、Gemini API keyが必要です。

#### 方法1: `.env`ファイルを使用（推奨）

1. プロジェクトルートに`.env`ファイルを作成：
   ```bash
   cp .env.example .env
   ```

2. `.env`ファイルを編集してAPI keyを設定：
   ```
   GEMINI_API_KEY=your-actual-api-key-here
   ```

#### 方法2: 環境変数を直接設定

**Windows (PowerShell)**:
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
pnpm test:e2e:auto-tagger-journey
```

**Windows (CMD)**:
```cmd
set GEMINI_API_KEY=your-api-key-here
pnpm test:e2e:auto-tagger-journey
```

**Mac/Linux**:
```bash
export GEMINI_API_KEY=your-api-key-here
pnpm test:e2e:auto-tagger-journey
```

### 2. プラグインをビルド

```bash
pnpm build
```

**重要**: コードを変更した場合は、必ず再ビルドしてください！

### 3. テストを実行

```bash
# 全E2Eテストを実行
pnpm test:e2e

# Auto Taggerのユーザージャーニーテストのみ
pnpm test:e2e:auto-tagger-journey

# Auto Taggerの統合テストのみ
pnpm test:e2e:auto-tagger
```

## 📋 トラブルシューティング

### ❌ "GEMINI_API_KEY not set" エラー

**症状**:
```
⚠️ GEMINI_API_KEY not set. Skipping test that requires API calls.
```

**解決方法**:
1. `.env`ファイルが存在するか確認
2. `.env`ファイルに正しいAPI keyが設定されているか確認
3. API keyに余分なスペースや引用符がないか確認

### ❌ "Folder already exists" エラー

**症状**:
```
🖥️ BROWSER [ERROR]: Failed to write to log file: Error: Folder already exists.
```

**解決方法**:
プラグインを再ビルドしてください：
```bash
pnpm build
```

### ❌ タグが追加されない

**症状**:
```
Error: expect(received).toContain(expected)
Expected substring: "tags:"
Received string: "# Note 1..."
```

**原因**:
1. API keyが無効または期限切れ
2. ネットワーク接続の問題
3. Gemini APIのレート制限

**解決方法**:
1. API keyが有効か確認: https://makersuite.google.com/app/apikey
2. ネットワーク接続を確認
3. しばらく待ってから再実行

### ❌ テストがタイムアウトする

**症状**:
```
Test timeout of 30000ms exceeded
```

**解決方法**:
1. ネットワーク接続を確認
2. `playwright.config.ts`でタイムアウトを増やす：
   ```typescript
   timeout: 60000, // 60秒に増やす
   ```

## 🔍 デバッグ方法

### UIモードで実行

テストの実行過程を視覚的に確認：
```bash
pnpm test:e2e:ui
```

### ヘッドフルモードで実行

ブラウザを表示してテストを実行：
```bash
pnpm test:e2e:headed
```

### デバッグログを有効化

```bash
pnpm test:e2e:debug
```

### 特定のテストのみ実行

```bash
# テスト名で絞り込み
pnpm playwright test -g "TC-E2E-001"

# 初回セットアップフローのみ
pnpm playwright test -g "Initial setup"
```

## 📊 テスト結果の確認

### レポートを表示

```bash
pnpm playwright show-report
```

### スクリーンショットを確認

失敗したテストのスクリーンショットは以下に保存されます：
```
e2e/test-results/[test-name]/test-failed-1.png
```

### ログを確認

テストログは以下に保存されます：
```
e2e/test-results/[test-name]/error-context.md
```

## ✅ テスト成功の確認

テストが成功すると、以下のような出力が表示されます：

```
✅ API key found, configuring plugin...
Vault is ready, entering test body.
Test body finished.
Test 'TC-E2E-001: Initial setup and first-time usage flow' finished with status: passed.

1 passed (30s)
```

## 🔄 継続的インテグレーション (CI)

GitHub Actionsでテストを実行する場合：

1. リポジトリのSecretsに`GEMINI_API_KEY`を追加
2. ワークフローファイルで環境変数を設定：

```yaml
- name: Run E2E Tests
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: pnpm test:e2e
```

## 📝 テストをスキップする

API keyなしでテストを実行すると、API呼び出しが必要なテストは自動的にスキップされます：

```
⚠️ GEMINI_API_KEY not set. Skipping test that requires API calls.
   Set GEMINI_API_KEY environment variable or create a .env file

8 skipped
```

これは正常な動作です。API keyを設定すれば、テストが実行されます。

## 🎯 ベストプラクティス

1. **コード変更後は必ず再ビルド**
   ```bash
   pnpm build && pnpm test:e2e:auto-tagger-journey
   ```

2. **API keyを安全に管理**
   - `.env`ファイルは`.gitignore`に含まれています
   - API keyをコミットしないでください

3. **テストを段階的に実行**
   ```bash
   # まず1つのテストで確認
   pnpm playwright test -g "TC-E2E-001"

   # 成功したら全テストを実行
   pnpm test:e2e:auto-tagger-journey
   ```

4. **失敗時はログを確認**
   - ブラウザコンソールのエラーメッセージ
   - スクリーンショット
   - error-context.md

## 🆘 サポート

問題が解決しない場合：

1. `e2e/README.md`を確認
2. `debugging-guide.md`を参照
3. Issueを作成（API keyは含めないでください！）

---

**Happy Testing! 🎉**
