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
  assert.match(pageSource, /表題・添付資料を編集/);
  assert.match(pageSource, /const renderHomeLessonEditor/);
  assert.match(pageSource, /const renderLessonResourceActions/);
  assert.match(pageSource, /lesson-summary__meta/);
  assert.match(pageSource, /lesson-summary__topic/);
});

test("shortcut settings stay in the current device", () => {
  assert.match(pageSource, /const \[appIconUrl, setAppIconUrl\]/);
  assert.match(pageSource, /SHORTCUT_SETTINGS_STORAGE_KEY/);
  assert.match(pageSource, /const saveAppIconUrl = \(/);
  assert.match(pageSource, /const uploadAppIcon = async/);
  assert.match(pageSource, /アプリアイコン/);
  assert.match(pageSource, /ショートカット表示名/);
  assert.match(pageSource, /apple-mobile-web-app-title/);
  assert.match(pageSource, /保存完了！ この端末のショートカット名とアプリアイコンを保存しました/);
  assert.match(pageSource, /aria-live="polite"/);
  assert.match(pageSource, /画像を選ぶ／ここにドロップ/);
  assert.match(pageSource, /event\.dataTransfer\.files/);
  assert.match(pageSource, /画像サイズが大きすぎます/);
  assert.match(pageSource, /MAX_SHORTCUT_ICON_SIZE_BYTES/);
  assert.doesNotMatch(pageSource, /adminApiPath\("\/api\/admin\/settings"\)/);
});

test("base lessons expose the same lesson metadata editor as added lessons", () => {
  assert.match(pageSource, /講師名・動画・資料を編集/);
  assert.match(pageSource, /BASE_LESSON_METADATA/);
  assert.match(pageSource, /baseLessonMetadata/);
  assert.match(pageSource, /資料URL（Enterで追加）/);
});

test("image resources open in an in-app image preview", () => {
  assert.match(pageSource, /const \[imagePreview, setImagePreview\]/);
  assert.match(pageSource, /画像資料を画面内で開く/);
  assert.match(pageSource, /className="image-preview"/);
  const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(cssSource, /\.settings-sheet__header\s*\{\s*position: sticky/);
  assert.match(cssSource, /\.image-preview__top\s*\{\s*position: sticky/);
});

test("the default launcher icon uses the lesson-review image", () => {
  const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layoutSource, /icons\/lesson-review-default\.png\?v=59/);
  assert.doesNotMatch(layoutSource, /icons\/serina\.png/);
});

test("quiz editors accept image drops for both faces", () => {
  assert.match(pageSource, /const uploadQuizImage = async/);
  assert.match(pageSource, /問題に画像を追加（ドロップ・貼り付け可）/);
  assert.match(pageSource, /解説に画像を追加（ドロップ・貼り付け可）/);
});

test("list card editor can replace the first image on either face", () => {
  assert.match(pageSource, /const replaceListImage = \(field: "question" \| "answer", file: File\)/);
  assert.match(pageSource, /IMAGE_MARKDOWN_PATTERN/);
  assert.match(pageSource, /問題の画像を差し替え/);
  assert.match(pageSource, /解説の画像を差し替え/);
  assert.match(pageSource, /currentText\.replace\(IMAGE_MARKDOWN_PATTERN, imageMarkdown\)/);
});

test("an open list card editor is not draggable", () => {
  assert.match(pageSource, /draggable=\{listEditDraft\?\.id !== card\.id\}/);
  assert.match(pageSource, /if \(listEditDraft\?\.id === card\.id\) \{[\s\S]*?event\.preventDefault\(\)/);
});
