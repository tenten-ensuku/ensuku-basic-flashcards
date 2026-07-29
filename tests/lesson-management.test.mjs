import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../worker/admin-api.mjs", import.meta.url), "utf8");

test("shared lesson metadata supports edit, logical delete, restore, and ordering", () => {
  assert.match(workerSource, /lessonPath[\s\S]*?request\.method === "PUT"/);
  assert.match(workerSource, /lessonPath[\s\S]*?request\.method === "DELETE"/);
  assert.match(workerSource, /\/api\/admin\/lessons\/order/);
  assert.match(workerSource, /deletedLessons/);
  assert.match(pageSource, /const saveLessonMetadata = async/);
  assert.match(pageSource, /const deleteLessonMetadata = async/);
  assert.match(pageSource, /const restoreLessonMetadata = async/);
  assert.match(pageSource, /const reorderLessons = async/);
  assert.match(pageSource, /授業情報を編集/);
  assert.match(pageSource, /授業を復元/);
});

test("quiz editors accept image drops for both faces", () => {
  assert.match(pageSource, /const uploadQuizImage = async/);
  assert.match(pageSource, /問題に画像を追加（ドロップ・貼り付け可）/);
  assert.match(pageSource, /解説に画像を追加（ドロップ・貼り付け可）/);
});
