import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  APP_VERSION,
  FLASHCARDS,
  LEGACY_STORAGE_KEY,
  LESSONS,
  NEJIMAKI_FLASHCARDS,
  STORAGE_KEY,
  createSessionCards,
  formatDuration,
  getRank,
  readProgress,
  updateReviewIds,
} from "../app/lib/flashcards.mjs";

test("ships two 50-card lessons as ver7", () => {
  assert.equal(APP_VERSION, 7);
  assert.equal(STORAGE_KEY, "ensuku-basic-flashcards-v4");
  assert.equal(LEGACY_STORAGE_KEY, "ensuku-basic-flashcards-v3");
  assert.equal(FLASHCARDS.length, 50);
  assert.equal(NEJIMAKI_FLASHCARDS.length, 50);
  assert.deepEqual(FLASHCARDS.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.deepEqual(NEJIMAKI_FLASHCARDS.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.equal(LESSONS.tenten.label, "7/14　てんてん授業");
  assert.equal(LESSONS.nejimaki.label, "7/2　ねじまき鳥先生");

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
  assert.equal(FLASHCARDS[23].question, "2234ｍのような□×はなんと");
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
});

test("creates ordered and isolated sessions for both lessons", () => {
  const all = createSessionCards("tenten", "all");
  assert.equal(all.length, 50);
  assert.deepEqual(all.map(({ id }) => id), Array.from({ length: 50 }, (_, index) => index + 1));

  const review = createSessionCards("nejimaki", "review", [30, 3, 9]);
  assert.deepEqual(review.map(({ id }) => id), [3, 9, 30]);
  assert.equal(review[0].question, NEJIMAKI_FLASHCARDS[2].question);
  assert.throws(() => createSessionCards("missing", "all"), /Unknown lesson/);
  assert.throws(() => createSessionCards("tenten", "quick"), /Unknown session mode/);
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
  const empty = { reviewCardIdsByLesson: { tenten: [], nejimaki: [] }, lastSession: null };
  assert.deepEqual(readProgress(null), empty);
  assert.deepEqual(readProgress("{broken"), empty);
  assert.deepEqual(
    readProgress(JSON.stringify({
      reviewCardIdsByLesson: { tenten: [3, 3, 50, 51, "9"], nejimaki: [25, 1, 60] },
      lastSession: { lessonId: "nejimaki", mode: "all" },
    })),
    {
      reviewCardIdsByLesson: { tenten: [3, 50], nejimaki: [1, 25] },
      lastSession: { lessonId: "nejimaki", mode: "all" },
    },
  );
  assert.deepEqual(
    readProgress(JSON.stringify({ reviewCardIds: [3, 50], lastSession: { mode: "review" } })),
    {
      reviewCardIdsByLesson: { tenten: [3, 50], nejimaki: [] },
      lastSession: { mode: "review" },
    },
  );
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(125), "2:05");
});
