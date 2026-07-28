import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("home lessons and the quiz use compact expandable cards", () => {
  assert.match(pageSource, /type HomeSectionId = LessonId \| "quiz"/);
  assert.match(pageSource, /useState<HomeSectionId \| null>\(null\)/);
  assert.match(pageSource, /data-testid=\{`toggle-lesson-\$\{lessonId\}`\}/);
  assert.match(pageSource, /data-testid="toggle-quiz-section"/);
  assert.match(pageSource, /aria-expanded=\{isOpen\}/);
  assert.match(pageSource, /aria-controls=\{contentId\}/);
  assert.match(pageSource, /mode-panel__content/);
  assert.match(pageSource, /quiz-launch-content/);
  assert.match(cssSource, /\.mode-panel--collapsible\s*\{/);
  assert.match(cssSource, /\.lesson-summary\s*\{/);
  assert.match(cssSource, /\.lesson-summary__title\s*\{[\s\S]*?text-overflow: ellipsis;/);
});
