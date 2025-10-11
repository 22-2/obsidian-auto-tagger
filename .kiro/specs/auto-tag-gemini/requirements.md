# Requirements Document

## Introduction

Obsidian vaultのノートに対して、Gemini AIを使用して自動的にタグを付与する機能を実装します。ユーザーが指定したディレクトリ配下のマークダウンファイルを対象に、特定のタグを持たないノートを選出し、一度に5つのノートをバッチ処理して既存のvault内タグから適切なタグを提案・付与します。ユーザーが操作を中止するまで継続的に処理を行い、タグ付与の基準となるsystem instructionを設定可能にします。

## Requirements

### Requirement 1: タグ付与対象ノートの選出

**User Story:** プラグイン利用者として、特定の条件に合致するノートだけを自動タグ付けの対象にしたいので、対象ディレクトリとノート除外タグを設定できるようにしてほしい

#### Acceptance Criteria

1. WHEN ユーザーが設定画面で対象ディレクトリパスを指定 THEN システムはそのディレクトリ配下のマークダウンファイルのみを処理対象とする SHALL
2. WHEN ユーザーがノート除外タグを設定 THEN システムはそのタグを持つノートを処理対象から除外する SHALL
3. WHEN 対象ディレクトリが空または存在しない THEN システムはエラーメッセージを表示し処理を開始しない SHALL
4. WHEN ノート除外タグが設定されていない THEN システムは全てのノートを処理対象とする SHALL
5. IF 対象ノートが1つも見つからない THEN システムは「対象ノートがありません」というメッセージを表示する SHALL

### Requirement 2: Gemini AIによるタグ提案

**User Story:** プラグイン利用者として、vault内の既存タグから適切なタグをAIに選んでもらいたいが、特定のタグは提案から除外したいので、複数ノートの内容とフィルタリングされたタグ一覧をAIに渡して提案してもらいたい

#### Acceptance Criteria

1. WHEN システムがノートを処理する THEN vault内の全タグ一覧を取得する SHALL
2. WHEN ユーザーがタグ提案除外リストを設定している THEN システムはそれらのタグを提案候補から除外する SHALL
3. WHEN AIがタグを提案する THEN 各ノートに対してフィルタリング済みのvault内タグから適切な数のタグを選択する SHALL
4. WHEN ノート内容をAIに送信する THEN 一度に5つのノートの本文全体を含める SHALL
5. WHEN AIがレスポンスを返す THEN 各ノートに対する提案タグのリストを含む SHALL
6. WHEN AIからのレスポンスがエラーの場合 THEN システムはエラーログを記録し次のバッチに進む SHALL

### Requirement 3: System Instruction設定

**User Story:** プラグイン利用者として、タグ付けの基準や方針をAIに指示したいので、カスタムのsystem instructionを設定できるようにしてほしい

#### Acceptance Criteria

1. WHEN ユーザーが設定画面でsystem instructionを入力 THEN システムはその内容を保存する SHALL
2. WHEN AIにリクエストを送信する THEN 設定されたsystem instructionをプロンプトに含める SHALL
3. IF system instructionが空の場合 THEN デフォルトの指示文を使用する SHALL
4. WHEN system instructionが変更された THEN 次回のタグ付与処理から新しい指示が適用される SHALL
5. WHEN system instructionが5000文字を超える THEN システムは警告を表示する SHALL

### Requirement 4: 継続的な自動タグ付与処理

**User Story:** プラグイン利用者として、複数のノートに効率的にタグを付けたいので、中止するまで自動的に5つずつバッチ処理でタグを付与してほしい

#### Acceptance Criteria

1. WHEN ユーザーが自動タグ付け処理を開始 THEN システムは対象ノートを5つずつのバッチで順番に処理する SHALL
2. WHEN 1バッチ（5ノート）へのタグ付与が完了 THEN システムは自動的に次の5ノートを処理する SHALL
3. WHEN 残りのノートが5つ未満 THEN システムは残りのノート全てを1バッチとして処理する SHALL
4. WHEN ユーザーが停止ボタンをクリック THEN システムは現在のバッチ処理を完了後に停止する SHALL
5. WHEN 全ての対象ノートの処理が完了 THEN システムは完了メッセージを表示し自動的に停止する SHALL
6. WHEN 処理中にエラーが発生 THEN システムはエラーをログに記録し次のバッチの処理を継続する SHALL
7. WHEN 処理が実行中 THEN システムは進捗状況（処理済みノート数/全体）を表示する SHALL

### Requirement 5: タグの付与と保存

**User Story:** プラグイン利用者として、AIが提案したタグを確実にノートに追加したいので、ノートのfrontmatterまたは本文にタグを追加して保存してほしい

#### Acceptance Criteria

1. WHEN AIがタグを提案 THEN システムはノートのfrontmatterのtagsフィールドに追加する SHALL
2. IF frontmatterが存在しない THEN システムは新規にfrontmatterを作成してタグを追加する SHALL
3. WHEN タグを追加する THEN 既存のタグは保持したまま新しいタグを追加する SHALL
4. WHEN タグ追加後 THEN システムはファイルを保存する SHALL
5. IF 提案されたタグが既にノートに存在する THEN そのタグは追加しない SHALL

### Requirement 6: UI/UX

**User Story:** プラグイン利用者として、処理の状態を把握し操作できるようにしたいので、専用のビューで状態表示と操作ができるようにしてほしい

#### Acceptance Criteria

1. WHEN ユーザーがプラグインのビューを開く THEN 設定項目と開始/停止ボタンが表示される SHALL
2. WHEN 処理が実行中 THEN 現在処理中のノート名と進捗が表示される SHALL
3. WHEN 処理が停止中 THEN 開始ボタンが有効になる SHALL
4. WHEN 処理が実行中 THEN 停止ボタンが有効になり開始ボタンは無効になる SHALL
5. WHEN タグが付与される THEN 付与されたタグのリストがログとして表示される SHALL
6. WHEN エラーが発生 THEN エラーメッセージがログに表示される SHALL

### Requirement 7: ログファイルへの記録とサマリー表示

**User Story:** プラグイン利用者として、処理結果を後から確認できるようにしたいので、各処理の詳細をログファイルに記録し、最後に全体のサマリーを表示してほしい

#### Acceptance Criteria

1. WHEN 処理が開始される THEN システムは新しいログファイルを作成または既存ファイルに追記する SHALL
2. WHEN 各ノートにタグが付与される THEN システムはノート名、付与されたタグ、タイムスタンプをログファイルに記録する SHALL
3. WHEN エラーが発生 THEN システムはエラー内容とノート名をログファイルに記録する SHALL
4. WHEN 全ての処理が完了 THEN システムは処理したノート総数、成功数、失敗数、付与したタグ総数を表示する SHALL
5. WHEN 処理が中断される THEN システムはその時点までのサマリーを表示する SHALL
6. WHEN ログファイルが指定サイズを超える THEN システムは新しいログファイルを作成する SHALL
7. IF ログファイルへの書き込みに失敗 THEN システムはUI上にエラーを表示するが処理は継続する SHALL
