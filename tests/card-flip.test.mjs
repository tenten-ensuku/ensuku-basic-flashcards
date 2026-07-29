import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const sessionStart = pageSource.indexOf('{screen === "session" && currentCard && (');
const sessionEnd = pageSource.indexOf('{screen === "result" && lastSession && (');
const sessionSource = pageSource.slice(sessionStart, sessionEnd);

test("flashcard renders exactly one question or answer face", () => {
  assert.notEqual(sessionStart, -1);
  assert.ok(sessionEnd > sessionStart);
  assert.match(sessionSource, /revealed \? "card-face--answer" : "card-face--question"/);
  assert.match(
    sessionSource,
    /\{revealed \? \(\s*<div className="answer-block"[\s\S]*?\) : \(\s*<div className="question-text">/,
  );
  assert.match(sessionSource, /data-testid="show-question"/);
  assert.match(sessionSource, /問題を見る/);
  assert.doesNotMatch(sessionSource, />QUESTION</);
  assert.doesNotMatch(sessionSource, /THINK & REVEAL/);
  assert.doesNotMatch(sessionSource, /answer-divider/);
});

test("Space and Enter toggle the current card face", () => {
  assert.match(
    pageSource,
    /event\.key === " " \|\| event\.code === "Space" \|\| event\.key === "Enter"/,
  );
  assert.match(pageSource, /setRevealed\(\(value\) => !value\)/);
  assert.match(sessionSource, /onClick=\{\(\) => setRevealed\(false\)\}/);
});

test("rating is available only on the answer face and resets for the next card", () => {
  assert.equal(
    (sessionSource.match(/disabled=\{!revealed \|\| isAdvancing \|\| sessionEditField !== null\}/g) ?? []).length,
    2,
  );
  assert.match(pageSource, /setCardIndex\(\(index\) => index \+ 1\);\s*setRevealed\(false\);/);
});

test("flashcard sessions can resume and move to adjacent cards", () => {
  assert.match(pageSource, /const \[isContentLoading, setIsContentLoading\] = useState\(true\);/);
  assert.match(pageSource, /setCardsByLesson\(orderedCards\);[\s\S]*?setIsContentLoading\(false\);/);
  assert.match(pageSource, /if \(isContentLoading\) return;[\s\S]*?const sourceCards = cardsByLesson/);
  assert.match(pageSource, /disabled=\{isContentLoading\}/);
  assert.match(pageSource, /screen--home\$\{isContentLoading \? " screen--home-loading" : ""\}/);
  assert.match(pageSource, /授業カードを読み込んでいます…/);
  assert.match(cssSource, /\.screen--home-loading > \.mode-panel,[\s\S]*?visibility: hidden;/);
  assert.match(cssSource, /\.favorite-launch-panel \.lesson-summary__toggle\s*\{[\s\S]*?background: linear-gradient\(145deg, #fffdf2, #f7e6ab\);/);
  assert.match(pageSource, /type SavedFlashcardSession =/);
  assert.match(pageSource, /setSavedFlashcardSession\(stored\.session as SavedFlashcardSession \| null\)/);
  assert.match(pageSource, /const resumeSession = useCallback/);
  assert.match(pageSource, /data-testid=\{`resume-\$\{lessonId\}`\}/);
  assert.match(pageSource, /const moveSessionCard = useCallback/);
  assert.match(sessionSource, /session-nav-button--previous/);
  assert.match(sessionSource, /session-nav-button--next/);
  assert.match(pageSource, /persistFlashcardSession\(nextIndex, false\)/);
});

test("progress counts the current card without half-step reveal progress", () => {
  assert.match(
    pageSource,
    /\(\(cardIndex \+ 1\) \/ sessionCards\.length\) \* 100/,
  );
  assert.doesNotMatch(pageSource, /revealed \? 0\.5 : 0/);
});

test("flip styles preserve long content and reduced-motion preferences", () => {
  assert.match(cssSource, /\.flashcard--flippable\s*\{[\s\S]*?perspective: 1200px;/);
  assert.match(
    cssSource,
    /\.flashcard--flippable:not\(\.flashcard--revealed\)\s*\{[\s\S]*?background: linear-gradient\(145deg, #242424, #000000\);[\s\S]*?color: #ffffff;/,
  );
  assert.match(
    cssSource,
    /\.flashcard--flippable:not\(\.flashcard--revealed\) \.card-meta,[\s\S]*?\.question-text\s*\{[\s\S]*?color: #ffffff;/,
  );
  assert.match(cssSource, /\.card-face\s*\{[\s\S]*?animation: card-turn-in 300ms/);
  assert.match(cssSource, /\.reveal-button--back\s*\{/);
  assert.match(
    cssSource,
    /\.flashcard\s*\{[\s\S]*?overflow-x: hidden;[\s\S]*?overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/,
  );
  assert.match(
    cssSource,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.card-face\s*\{[\s\S]*?animation: none !important;/,
  );
});

test("session card images use compact spacing and valid block wrappers", () => {
  assert.match(sessionSource, /className="card-copy"><MahjongText text=\{currentCard\.answer\}/);
  assert.match(sessionSource, /<div className="question-text">/);
  assert.match(cssSource, /\.flashcard \.card-image\s*\{\s*margin: 6px auto;/);
});
