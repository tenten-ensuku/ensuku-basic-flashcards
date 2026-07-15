import assert from "node:assert/strict";
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

test("ships the corrected 50-card data set as ver2", () => {
  assert.equal(APP_VERSION, 2);
  assert.equal(STORAGE_KEY, "ensuku-basic-flashcards-v1");
  assert.equal(FLASHCARDS.length, 50);
  assert.deepEqual(FLASHCARDS.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));

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

  assert.deepEqual(FLASHCARDS[29], {
    id: 30,
    question: "5枚連続している形（23456）は何面待ち？",
    answer: "三面張（1・4・7待ち）",
  });
  assert.equal(FLASHCARDS[38].question.includes("両面2筋"), true);
  assert.equal(FLASHCARDS[49].answer, "三面張スキップ形");
});

test("creates non-duplicated sessions for all modes", () => {
  let value = 0;
  const deterministicRandom = () => {
    value = (value + 0.37) % 1;
    return value;
  };
  const quick = createSessionCards("quick", [], deterministicRandom);
  assert.equal(quick.length, 10);
  assert.equal(new Set(quick.map(({ id }) => id)).size, 10);

  const all = createSessionCards("all");
  assert.equal(all.length, 50);
  assert.equal(new Set(all.map(({ id }) => id)).size, 50);

  const review = createSessionCards("review", [3, 9, 30], () => 0.5);
  assert.deepEqual(new Set(review.map(({ id }) => id)), new Set([3, 9, 30]));
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
    readProgress(JSON.stringify({ reviewCardIds: [3, 3, 51, "9"], lastSession: { mode: "quick" } })),
    { reviewCardIds: [3], lastSession: { mode: "quick" } },
  );
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(125), "2:05");
});
