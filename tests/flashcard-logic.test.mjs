import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_VERSION,
  FLASHCARDS,
  LEGACY_STORAGE_KEY,
  LESSONS,
  NEJIMAKI_FLASHCARDS,
  SIX_TILE_FLASHCARDS,
  STORAGE_KEY,
  createSessionCards,
  formatDuration,
  getRank,
  mergeFlashcardOverrides,
  readProgress,
  updateReviewIds,
} from "../app/lib/flashcards.mjs";

test("ships three flashcard lessons as ver20", () => {
  assert.equal(APP_VERSION, 20);
  assert.equal(STORAGE_KEY, "ensuku-basic-flashcards-v4");
  assert.equal(LEGACY_STORAGE_KEY, "ensuku-basic-flashcards-v3");
  assert.equal(FLASHCARDS.length, 50);
  assert.equal(NEJIMAKI_FLASHCARDS.length, 50);
  assert.equal(SIX_TILE_FLASHCARDS.length, 30);
  assert.deepEqual(FLASHCARDS.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.deepEqual(NEJIMAKI_FLASHCARDS.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.deepEqual(SIX_TILE_FLASHCARDS.map(({ id }) => id), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.equal(LESSONS.tenten0718.label, "7/18　てんてん先生　6枚形+完全形何切る？");
  assert.equal(LESSONS.tenten0718.videoUrl, "https://youtu.be/VRqWc-waiDI");
  assert.equal(LESSONS.tenten.label, "7/14　てんてん先生　基礎講義復習");
  assert.equal(LESSONS.tenten.videoUrl, "https://www.youtube.com/watch?v=Gu7x_B0-3MU");
  assert.equal(LESSONS.nejimaki.label, "7/2　ねじまき鳥先生　基礎講義②");
  assert.equal(LESSONS.nejimaki.videoUrl, "https://www.youtube.com/watch?v=kBN6h2-U0rQ");

  const allText = FLASHCARDS.flatMap(({ question, answer }) => [question, answer]).join("\n");
  for (const typo of [
    "メンツ",
    "面ツ",
    "余上牌型",
    "完全系",
    "連続系",
    "瞬ツ",
    "リカン",
    "短期待ち",
    "筋のビールの法則",
    "街（受け入れ）",
    "6枚系",
    "スキップ系",
    "アンチョビ系",
    "両面カンチャン系",
    "3面ちゃん",
    "（新苦型）",
    "両面筋",
    "3面チャンスキップ系",
    "形（12345）",
  ]) {
    assert.equal(allText.includes(typo), false, `残存表記: ${typo}`);
  }

  assert.equal(allText.includes("面子を正しく抜くことで、何の一向聴か判断できるようになる目的は？"), false);
  assert.equal(FLASHCARDS[7].question, "ヘッドレス2型と相性が良いのは？");
  assert.equal(FLASHCARDS[8].answer, "順子とターツがくっついた5枚形。");
  assert.equal(FLASHCARDS[20].answer, "のべタン、亜両面、アンチョビ");
  assert.equal(FLASHCARDS[23].question, "2234ｍのような□×はなんという名称で呼ばれる形？");
  assert.equal(FLASHCARDS[29].question, "23456ｍは何待ち？");
  assert.equal(FLASHCARDS[29].answer, "147ｍ待ち");
  assert.equal(FLASHCARDS[30].answer, "孤立牌がターツをフォローしている2面子型一向聴。");
  assert.equal(FLASHCARDS[49].question.includes("1234ｍ245678ｐ"), true);
  assert.equal(FLASHCARDS[49].question.includes("発発発"), true);
  assert.equal(FLASHCARDS[49].answer.includes("発発発"), true);
  assert.equal(allText.includes("發"), false);

  assert.equal(NEJIMAKI_FLASHCARDS[24].question, "アンチョビ形の名付け親は何期生のだれ？");
  assert.equal(NEJIMAKI_FLASHCARDS[24].answer, "6期生ずぴたーさん");
  assert.equal(NEJIMAKI_FLASHCARDS[31].question.includes("24456ｍ"), true);
  assert.equal(NEJIMAKI_FLASHCARDS[44].question.includes("11ｍ"), true);
  assert.equal(SIX_TILE_FLASHCARDS[1].answer, "5連形プラス1（または三面張プラス1）。");
  assert.equal(SIX_TILE_FLASHCARDS[25].answer.includes("一盃口"), true);
  const sixTileText = SIX_TILE_FLASHCARDS.flatMap(({ question, answer }) => [question, answer]).join("\n");
  assert.equal(sixTileText.includes("5連携"), false);
  assert.equal(sixTileText.includes("3面ちゃん"), false);
  assert.equal(sixTileText.includes("ソース内"), false);
});

test("uses Japanese phrase-aware wrapping for card copy", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /@supports \(word-break: auto-phrase\)/);
  assert.match(css, /\.question-text,[\s\S]*word-break: auto-phrase/);
  assert.doesNotMatch(css, /\.question-text\s*\{[^}]*text-wrap:\s*balance/s);
});

test("creates ordered and isolated sessions for all lessons", () => {
  const all = createSessionCards("tenten", "all");
  assert.equal(all.length, 50);
  assert.deepEqual(all.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));

  const review = createSessionCards("nejimaki", "review", [30, 3, 9]);
  assert.deepEqual(review.map(({ id }) => id), [3, 9, 30]);
  assert.equal(review[0].question, NEJIMAKI_FLASHCARDS[2].question);
  const sixTile = createSessionCards("tenten0718", "all");
  assert.equal(sixTile.length, 30);
  assert.equal(sixTile[29].question, SIX_TILE_FLASHCARDS[29].question);
  const editedCards = FLASHCARDS.map((card) => card.id === 24
    ? { ...card, question: "管理画面で編集した問題" }
    : card);
  assert.equal(createSessionCards("tenten", "all", [], editedCards)[23].question, "管理画面で編集した問題");
  assert.throws(() => createSessionCards("missing", "all"), /Unknown lesson/);
  assert.throws(() => createSessionCards("tenten", "quick"), /Unknown session mode/);
});

test("removes deleted flashcards while preserving stable internal ids", () => {
  const merged = mergeFlashcardOverrides(SIX_TILE_FLASHCARDS, [
    { lessonId: "tenten0718", id: 2, question: "", answer: "", deleted: true },
    { lessonId: "tenten0718", id: 3, question: "編集後", answer: "編集後の答え" },
  ], "tenten0718");
  assert.equal(merged.length, 29);
  assert.deepEqual(merged.slice(0, 3).map(({ id }) => id), [1, 3, 4]);
  assert.equal(merged[1].question, "編集後");
  assert.deepEqual(createSessionCards("tenten0718", "review", [2, 3], merged).map(({ id }) => id), [3]);
});

test("includes the approved tile assets for every numbered suit", () => {
  for (const prefix of ["man", "pin", "sou"]) {
    for (let digit = 1; digit <= 9; digit += 1) {
      assert.equal(existsSync(`public/tiles/${prefix}${digit}-66-90-l.png`), true);
    }
  }
  assert.equal(existsSync("public/tiles/ji5-66-90-l.png"), true);
});

test("adds and removes review cards without duplicates", () => {
  assert.deepEqual(updateReviewIds([], 7, "again"), [7]);
  assert.deepEqual(updateReviewIds([7], 7, "again"), [7]);
  assert.deepEqual(updateReviewIds([7, 9], 7, "known"), [9]);
  assert.deepEqual(updateReviewIds([9], 3, "again"), [3, 9]);
});

test("uses the exact rank boundaries", () => {
  assert.equal(getRank(0), "D");
  assert.equal(getRank(49), "D");
  assert.equal(getRank(50), "C");
  assert.equal(getRank(64), "C");
  assert.equal(getRank(65), "B");
  assert.equal(getRank(79), "B");
  assert.equal(getRank(80), "A");
  assert.equal(getRank(89), "A");
  assert.equal(getRank(90), "S");
  assert.equal(getRank(100), "S");
});

test("recovers safely from unavailable or malformed saved data", () => {
  const empty = { reviewCardIdsByLesson: { tenten0718: [], tenten: [], nejimaki: [] }, lastSession: null };
  assert.deepEqual(readProgress(null), empty);
  assert.deepEqual(readProgress("{broken"), empty);
  assert.deepEqual(
    readProgress(JSON.stringify({
      reviewCardIdsByLesson: { tenten0718: [30, 31, 2], tenten: [3, 3, 50, 51, "9"], nejimaki: [25, 1, 60] },
      lastSession: { lessonId: "nejimaki", mode: "all" },
    })),
    {
      reviewCardIdsByLesson: { tenten0718: [2, 30], tenten: [3, 50], nejimaki: [1, 25] },
      lastSession: { lessonId: "nejimaki", mode: "all" },
    },
  );
  assert.deepEqual(
    readProgress(JSON.stringify({ reviewCardIds: [3, 50], lastSession: { mode: "review" } })),
    {
      reviewCardIdsByLesson: { tenten0718: [], tenten: [3, 50], nejimaki: [] },
      lastSession: { mode: "review" },
    },
  );
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(125), "2:05");
});
