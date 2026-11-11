#!/usr/bin/env node
// Reads feeds.opml, fetches every feed, and writes docs/data/articles.json.
// No server involved — this is meant to be run once a day by GitHub Actions.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const xml2js = require("xml2js");
const Parser = require("rss-parser");

const ROOT_DIR = path.join(__dirname, "..");
const OPML_PATH = path.join(ROOT_DIR, "feeds.opml");
const OUTPUT_PATH = path.join(ROOT_DIR, "docs", "data", "articles.json");

const FETCH_TIMEOUT_MS = 20_000;
const FETCH_CONCURRENCY = 5;
const RETENTION_DAYS = 30;
const MAX_ARTICLES = 1000;
const USER_AGENT =
  "github-rss-reader/1.0 (+https://github.com/; personal static feed reader)";

const rssParser = new Parser();

/** Parses feeds.opml into a flat list of { category, title, xmlUrl, htmlUrl }. */
async function loadFeedList() {
  const xml = fs.readFileSync(OPML_PATH, "utf8");
  const doc = await xml2js.parseStringPromise(xml, { explicitArray: true });

  const body = doc?.opml?.body?.[0];
  const categoryOutlines = body?.outline ?? [];

  const feeds = [];
  for (const categoryOutline of categoryOutlines) {
    const category = categoryOutline.$?.title || categoryOutline.$?.text || "Uncategorized";
    const feedOutlines = categoryOutline.outline ?? [];
    for (const feedOutline of feedOutlines) {
      const attrs = feedOutline.$ || {};
      if (!attrs.xmlUrl) continue;
      feeds.push({
        category,
        title: attrs.title || attrs.text || attrs.xmlUrl,
        xmlUrl: attrs.xmlUrl,
        htmlUrl: attrs.htmlUrl || "",
      });
    }
  }
  return feeds;
}

/** Runs `fn` over `items` with limited concurrency, preserving order. */
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return results;
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.xmlUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();
    const parsed = await rssParser.parseString(xml);

    const items = (parsed.items || []).map((item) => toArticle(item, feed));

    return {
      status: "ok",
      feed,
      itemCount: items.length,
      items,
    };
  } catch (err) {
    return {
      status: "error",
      feed,
      itemCount: 0,
      items: [],
      error: err.message || String(err),
    };
  }
}

function toArticle(item, feed) {
  const link = item.link || "";
  const guid = item.guid || link;
  const pubDate = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : null);
  const id = crypto.createHash("sha1").update(guid || `${feed.xmlUrl}:${item.title}`).digest("hex");

  return {
    id,
    title: (item.title || "(no title)").trim(),
    link,
    pubDate,
    category: feed.category,
    feedTitle: feed.title,
    feedUrl: feed.htmlUrl,
    contentSnippet: makeSnippet(item.contentSnippet || item.content || ""),
  };
}

function makeSnippet(text, maxLength = 300) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > maxLength ? `${flat.slice(0, maxLength)}…` : flat;
}

function loadExistingArticles() {
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

function mergeArticles(existing, fresh) {
  const byId = new Map();
  for (const article of existing) byId.set(article.id, article);
  for (const article of fresh) byId.set(article.id, article); // fresh data wins on conflict

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

  return [...byId.values()]
    .filter((a) => !a.pubDate || new Date(a.pubDate).getTime() >= cutoff)
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, MAX_ARTICLES);
}

async function main() {
  const feeds = await loadFeedList();
  console.log(`Loaded ${feeds.length} feeds from feeds.opml`);

  const results = await mapWithConcurrency(feeds, FETCH_CONCURRENCY, fetchFeed);

  const okResults = results.filter((r) => r.status === "ok");
  const errorResults = results.filter((r) => r.status === "error");

  for (const r of errorResults) {
    console.warn(`  [FAIL] ${r.feed.title}: ${r.error}`);
  }
  console.log(`Fetched ${okResults.length}/${feeds.length} feeds successfully`);

  const freshArticles = results.flatMap((r) => r.items);
  const existingArticles = loadExistingArticles();
  const articles = mergeArticles(existingArticles, freshArticles);

  const categories = [...new Set(feeds.map((f) => f.category))];

  const output = {
    updatedAt: new Date().toISOString(),
    categories,
    feeds: results.map((r) => ({
      title: r.feed.title,
      category: r.feed.category,
      xmlUrl: r.feed.xmlUrl,
      htmlUrl: r.feed.htmlUrl,
      status: r.status,
      itemCount: r.itemCount,
      error: r.error,
    })),
    articles,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote ${articles.length} articles to ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);

  if (errorResults.length === feeds.length) {
    process.exitCode = 1; // every feed failed — surface this as a CI failure
  }
}

main().catch((err) => {
  console.error("fetch.js failed:", err);
  process.exitCode = 1;
});
