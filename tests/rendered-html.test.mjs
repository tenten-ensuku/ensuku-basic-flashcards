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
  assert.match(html, /一向聴 基礎講義フラッシュカード/);
  assert.match(html, /ver(?:<!-- -->)?10/);
  assert.match(html, /授業の復習/);
  assert.match(html, /7\/14　てんてん授業/);
  assert.match(html, /7\/2　ねじまき鳥先生/);
  assert.match(html, /2 LESSONS \/ 100 CARDS/);
  assert.doesNotMatch(html, /ランダム10問/);
  assert.match(html, /全50問/);
  assert.match(html, /解き直しカード/);
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
});
