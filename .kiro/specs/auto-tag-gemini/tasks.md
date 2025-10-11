# Implementation Plan

- [x] 1. 設定管理の拡張
  - 既存の`settings.ts`に`AutoTaggerSettings`インターフェースを追加
  - デフォルト設定値を定義
  - 設定タブに自動タグ付けセクションを追加（対象ディレクトリ、除外タグ、system instruction、ログパス）
  - _Requirements: 1.1, 1.2, 3.1, 3.2_

- [x] 2. NoteSelector サービスの実装
  - `src/services/noteSelector.ts`を作成
  - 指定ディレクトリ配下のマークダウンファイル取得機能を実装
  - 除外タグによるフィルタリング機能を実装
  - エラーハンドリング（存在しないディレクトリ、空の結果）を実装
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. LoggerService の実装
  - `src/services/logger.ts`を作成
  - ログエントリの記録機能を実装（タイムスタンプ、ノートパス、タグ、成功/失敗）
  - サマリー記録機能を実装（総数、成功数、失敗数、タグ総数）
  - ログファイルのサイズチェックとローテーション機能を実装
  - _Requirements: 7.1, 7.2, 7.3, 7.6, 7.7_

- [x] 4. Gemini API プロンプト拡張
  - `src/api/gemini.ts`に`buildAutoTaggingPrompt`関数を追加
  - system instructionをプロンプトに組み込む
  - 5ノートのバッチ処理用のプロンプト構造を実装
  - 除外タグリストをフィルタリングに適用
  - _Requirements: 2.1, 2.2, 2.3, 3.2_

- [x] 5. AutoTagger サービスの実装
- [x] 5.1 基本構造とコンストラクタを実装
  - `src/services/autoTagger.ts`を作成
  - `AutoTaggerState`インターフェースを定義
  - コンストラクタで依存関係を注入（App、設定、LoggerService）
  - _Requirements: 4.1_

- [x] 5.2 バッチ処理ロジックを実装
  - `processBatch`メソッドを実装（5ノートずつ処理）
  - Gemini APIを呼び出してタグ提案を取得
  - レスポンスのパースとエラーハンドリング
  - _Requirements: 2.3, 2.4, 2.5, 4.2_

- [x] 5.3 タグ適用機能を実装
  - `applyTagsToNote`メソッドを実装
  - frontmatterへのタグ追加（既存タグを保持）
  - 重複タグの除外
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.4 メイン処理ループを実装
  - `start`メソッドを実装（継続的処理）
  - 進捗コールバックの呼び出し
  - バッチ完了コールバックの呼び出し
  - 残りノートが5未満の場合の処理
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5.5 停止機能とサマリー生成を実装
  - `stop`メソッドを実装（現在のバッチ完了後に停止）
  - `getSummary`メソッドを実装
  - 状態管理（isRunning、shouldStop）
  - _Requirements: 4.4, 4.5, 7.4, 7.5_

- [x] 6. AutoTagView Svelteコンポーネントの実装
- [x] 6.1 基本UIレイアウトを作成
  - `src/view/AutoTagView.svelte`を作成
  - 設定入力フィールド（対象ディレクトリ、除外タグ、system instruction）
  - 開始/停止ボタン
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 6.2 進捗表示とログ表示を実装
  - 進捗バーまたはカウンター（処理済み/全体）
  - リアルタイムログ表示エリア
  - 現在処理中のノート名表示
  - _Requirements: 6.2, 6.5, 6.6, 4.7_

- [x] 6.3 AutoTaggerサービスとの統合
  - 開始ボタンクリック時にAutoTagger.start()を呼び出し
  - 停止ボタンクリック時にAutoTagger.stop()を呼び出し
  - 進捗コールバックでUIを更新
  - バッチ完了コールバックでログを追加
  - _Requirements: 4.1, 4.4_

- [x] 6.4 サマリー表示を実装
  - 処理完了時にサマリーを表示
  - 中断時も途中までのサマリーを表示
  - _Requirements: 7.4, 7.5_

- [x] 7. Obsidian View統合
  - `src/view/autoTagView.ts`を作成
  - `ItemView`を継承してAutoTagViewをラップ
  - ビュータイプを登録
  - _Requirements: 6.1_

- [ ] 8. プラグインメインファイルの統合
  - `src/main.ts`にAutoTagViewを登録
  - リボンアイコンを追加
  - コマンドパレットにコマンドを追加
  - 設定の読み込み/保存を拡張
  - _Requirements: 6.1_

- [ ] 9. エラーハンドリングの強化
  - 設定エラー（空のディレクトリ、API key未設定）のチェック
  - API呼び出しエラーの適切な処理
  - ファイル操作エラーの処理
  - ユーザーへの通知（Notice）
  - _Requirements: 1.3, 2.5, 4.5, 4.6, 7.7_

- [ ] 10. 統合テストとデバッグ
  - 小規模データセット（5-10ノート）でのテスト
  - バッチ処理の動作確認
  - 停止機能の動作確認
  - ログファイルの出力確認
  - エラーケースのテスト
  - _Requirements: All_
