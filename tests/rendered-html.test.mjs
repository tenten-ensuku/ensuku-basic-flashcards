import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the production flashcard home screen", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/i);
  assert.match(html, /<title>一向聴 基礎講義フラッシュカード<\/title>/i);
  assert.match(html, /授業の復習に/);
  assert.match(html, /ver(?:<!-- -->)?19/);
  assert.match(html, /7\/16　ねじまき鳥先生/);
  assert.match(html, /基本序列マスタークイズ/);
  assert.match(html, /https:\/\/youtu\.be\/NE1UHrZkg6g/);
  assert.match(html, /クイズを始める/);
  assert.match(html, /7\/18　てんてん先生/);
  assert.match(html, /6枚形\+完全形何切る？/);
  assert.match(html, /data-testid="start-all-tenten0718"/);
  assert.match(html, /7\/14　てんてん先生　基礎講義復習/);
  assert.match(html, /https:\/\/www\.youtube\.com\/watch\?v=Gu7x_B0-3MU/);
  assert.match(html, /7\/2　ねじまき鳥先生　基礎講義②/);
  assert.match(html, /https:\/\/www\.youtube\.com\/watch\?v=kBN6h2-U0rQ/);
  assert.equal((html.match(/class="youtube-icon-button"/g) ?? []).length, 3);
  assert.match(html, /7\/16　ねじまき鳥先生<\/h2><a class="youtube-icon-button"/);
  assert.match(html, /基礎講義復習<\/span><\/h2><a class="youtube-icon-button"/);
  assert.match(html, /基礎講義②<\/span><\/h2><a class="youtube-icon-button"/);
  assert.match(html, /クイズ問題一覧/);
  assert.doesNotMatch(html, /MULTIPLE CHOICE QUIZ|SELECT MODE|1 QUIZ \/ 2 FLASHCARD LESSONS/);
  assert.doesNotMatch(html, /孤立牌の基本序列から特殊形まで、選んですぐ解説を確認できます。/);
  assert.doesNotMatch(html, /ランダム10問/);
  assert.match(html, /全(?:<!-- -->)?50(?:<!-- -->)?問/);
  assert.match(html, /解き直しカード/);
  assert.match(html, /管理画面/);
  assert.equal(html.indexOf("7/16　ねじまき鳥先生") < html.indexOf("7/14　てんてん先生　基礎講義復習"), true);
  assert.equal(html.indexOf("7/18　てんてん先生") < html.indexOf("7/14　てんてん先生　基礎講義復習"), true);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("publishes the expected social metadata", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /property="og:title" content="一向聴 基礎講義フラッシュカード"/);
  assert.match(
    html,
    /property="og:image" content="https:\/\/ensuku-basic-flashcards\.kobotenmitsu\.chatgpt\.site\/og-card\.png"/,
  );
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="theme-color" content="#48d6b0"/);
  assert.match(html, /rel="icon" href="https:\/\/ensuku-basic-flashcards\.kobotenmitsu\.chatgpt\.site\/icons\/ensuku-192\.png"/);
  assert.match(html, /rel="apple-touch-icon" href="https:\/\/ensuku-basic-flashcards\.kobotenmitsu\.chatgpt\.site\/icons\/ensuku-180\.png"/);
});
