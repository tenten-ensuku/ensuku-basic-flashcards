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

test("existing lessons can save and manage attached resource URLs", () => {
  assert.match(pageSource, /const \[lessonEditResources, setLessonEditResources\]/);
  assert.match(pageSource, /資料URL（任意）/);
  assert.match(pageSource, /resources: lessonEditResources/);
  assert.match(workerSource, /const resources = Array\.isArray\(body\?\.resources\) \? body\.resources : null/);
  assert.match(workerSource, /DELETE FROM lesson_resources WHERE lesson_id = \?/);
  assert.match(workerSource, /INSERT INTO lesson_resources/);
});

test("the app icon can be uploaded, set by URL, and shared through the API", () => {
  assert.match(pageSource, /const \[appIconUrl, setAppIconUrl\]/);
  assert.match(pageSource, /const saveAppIconUrl = async/);
  assert.match(pageSource, /const uploadAppIcon = async/);
  assert.match(pageSource, /アプリアイコン/);
  assert.match(workerSource, /url\.pathname === "\/api\/admin\/settings" && request\.method === "PUT"/);
  assert.match(workerSource, /app_icon_url/);
  assert.match(workerSource, /APP_SETTINGS_SCHEMA_SQL/);
});

test("quiz editors accept image drops for both faces", () => {
  assert.match(pageSource, /const uploadQuizImage = async/);
  assert.match(pageSource, /問題に画像を追加（ドロップ・貼り付け可）/);
  assert.match(pageSource, /解説に画像を追加（ドロップ・貼り付け可）/);
});
