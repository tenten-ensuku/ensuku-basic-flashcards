import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("favorites use a compact expandable home card and can be toggled from sessions and lists", () => {
  assert.match(source, /data-testid="open-favorites"/);
  assert.match(source, /data-testid="toggle-favorites-section"/);
  assert.match(source, /data-testid="start-favorites-session"/);
  assert.match(source, /const startFavoriteSession/);
  assert.match(source, /data-testid="toggle-favorite-session"/);
  assert.match(source, /data-testid=\{`toggle-favorite-list-\$\{card\.id\}`\}/);
  assert.match(source, /screen === "favorites"/);
  assert.match(source, /favoriteCardIdsByLesson/);
  assert.match(source, /お気に入りに追加しました/);
  assert.match(source, /お気に入りから削除しました/);
  assert.match(source, /title=\{currentCardIsFavorite \? "お気に入りから削除" : "お気に入りに追加"\}/);
});

test("session controls put clear navigation around the favorite action", () => {
  assert.doesNotMatch(source, /思い出せましたか？/);
  assert.match(source, /className="session-nav-button session-nav-button--previous"/);
  assert.match(source, /className=\{`session-nav-button session-nav-button--favorite/);
  assert.match(source, /className="session-nav-button session-nav-button--next"/);
});

test("flashcard lists expose add and delete controls", () => {
  assert.match(source, /data-testid="add-card-from-list"/);
  assert.match(source, /data-testid="add-card-from-list-bottom"/);
  assert.match(source, /deleteCardFromList\(card, cardNumber \+ 1\)/);
});
