# 設定ファイル

## Inoreader APIキーの取得

1. https://www.inoreader.com/settings/developer を開く
2. 「New application」をクリック
3. App名は何でもOK（例: inoreader-digester）
4. 取得したApp IDとApp Keyを下記ファイルに記入

## 設定ファイル

`config/.env` を作成して以下を記入（.gitignoreに含まれているのでGitにはあがりません）：

```
INOREADER_APP_ID=xxxxx
INOREADER_APP_KEY=xxxxx
INOREADER_TOKEN=xxxxx        # OAuth後に取得
GMAIL_USER=keiichi.takahashi@gmail.com
MARK_READ_ENDPOINT=https://your-worker.workers.dev/mark-read
```

## OAuthトークンの取得

セットアップスクリプトを実行すると、ブラウザが開いて認証できます：

```bash
node src/auth.js
```
