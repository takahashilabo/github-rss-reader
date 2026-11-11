# github-rss-reader

GitHub Actions + GitHub Pagesで動くサーバーレスRSSリーダー。

## 仕組み

1. GitHub Actionsが毎日1回RSSフィードをfetch
2. 記事データをJSONとして保存
3. GitHub Pagesで静的HTMLとして閲覧

## 構成

```
github-rss-reader/
├── feeds.opml          # フィード一覧
├── .github/
│   └── workflows/
│       └── fetch.yml   # GitHub Actions定義
├── src/
│   └── fetch.js        # フィードfetchスクリプト
├── docs/               # GitHub Pages公開フォルダ
│   ├── index.html      # リーダーUI
│   └── data/           # 記事JSONデータ
└── README.md
```

## 自分用にセットアップする

`git clone` しただけでは動きません。GitHub Actions（定期実行）とGitHub Pages（公開ページ）は
GitHub上のリポジトリに対して動く機能なので、以下の手順がすべて必要です。

1. **このリポジトリをFork、または自分のアカウントに新規リポジトリとしてpush**
2. **GitHub Pagesを有効化**
   - Settings → Pages
   - Branch: `main` / Folder: `/docs` を選択
3. **Actionsのワークフロー権限を「読み書き可能」に変更**
   - Settings → Actions → General → Workflow permissions
   - 「Read and write permissions」を選択して保存
   - （これをしないと、fetch結果を`articles.json`としてコミットし直すステップが403で失敗します）
4. **`feeds.opml` を自分の好きなフィードに書き換える**
   - カテゴリごとの`<outline>`の中に、フィード1件につき1行
   - `xmlUrl`がRSS/AtomのURL、`title`/`text`が表示名
5. **初回実行**
   - Actionsタブ → `Fetch RSS feeds` → `Run workflow` で手動実行して動作確認
   - 問題なければ、以降は毎日08:00 JSTに自動実行される

### Forkする場合の注意点

- Forkしたリポジトリでは、スケジュール実行（`schedule:`）は**デフォルトで無効**になっています。
  Actionsタブで明示的に有効化してください。
- GitHubの仕様上、**60日間リポジトリに動き（push等）がないとスケジュール実行は自動停止**します。
  止まった場合はActionsタブから手動実行すれば再び動き出します。

## 手動実行（ローカル）

```bash
npm install
node src/fetch.js
```

`docs/data/articles.json` が更新されるので、内容を確認してからpushしてください。
