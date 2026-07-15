import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  APP_VERSION,
  FLASHCARDS,
  STORAGE_KEY,
  createSessionCards,
  formatDuration,
  getRank,
  readProgress,
  updateReviewIds,
} from "../app/lib/flashcards.mjs";

test("ships the updated 51-card data set as ver3", () => {
  assert.equal(APP_VERSION, 3);
  assert.equal(STORAGE_KEY, "ensuku-basic-flashcards-v2");
  assert.equal(FLASHCARDS.length, 51);
  assert.deepEqual(FLASHCARDS.map(({ id }) => id), Array.from({ length: 51 }, (_, index) => index + 1));

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

  assert.equal(FLASHCARDS[22].question, "単騎待ちとは？");
  assert.equal(FLASHCARDS[30].question, "23456ｍは何待ち？");
  assert.equal(FLASHCARDS[30].answer, "147ｍ待ち");
  assert.equal(FLASHCARDS[50].question.includes("1234ｍ245678ｐ"), true);
});

test("creates ordered sessions for all questions and redo cards", () => {
  const all = createSessionCards("all");
  assert.equal(all.length, 51);
  assert.deepEqual(all.map(({ id }) => id), Array.from({ length: 51 }, (_, index) => index + 1));

  const review = createSessionCards("review", [30, 3, 9]);
  assert.deepEqual(review.map(({ id }) => id), [3, 9, 30]);
  assert.throws(() => createSessionCards("quick"), /Unknown session mode/);
});

test("includes the approved tile assets for every numbered suit", () => {
  for (const prefix of ["man", "pin", "sou"]) {
    for (let digit = 1; digit <= 9; digit += 1) {
      assert.equal(existsSync(`public/tiles/${prefix}${digit}-66-90-l.png`), true);
    }
  }
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
  assert.deepEqual(readProgress(null), { reviewCardIds: [], lastSession: null });
  assert.deepEqual(readProgress("{broken"), { reviewCardIds: [], lastSession: null });
  assert.deepEqual(
    readProgress(JSON.stringify({ reviewCardIds: [3, 3, 51, 52, "9"], lastSession: { mode: "all" } })),
    { reviewCardIds: [3, 51], lastSession: { mode: "all" } },
  );
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(125), "2:05");
});
