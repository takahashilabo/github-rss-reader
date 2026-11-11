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

## セットアップ

1. このリポジトリをGitHubにpush
2. GitHub Pages を `docs/` フォルダから有効化
3. GitHub Actionsが毎日自動実行される

## 手動実行

```bash
node src/fetch.js
```
