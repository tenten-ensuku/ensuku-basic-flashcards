import assert from "node:assert/strict";
import test from "node:test";

import { handleAdminApi } from "../worker/admin-api.mjs";

function mockDb() {
  const rows = new Map();
  const quizRows = new Map();
  return {
    rows,
    quizRows,
    prepare(query) {
      let values = [];
      const statement = {
        bind(...nextValues) {
          values = nextValues;
          return statement;
        },
        async all() {
          if (/FROM quiz_overrides/.test(query)) {
            return {
              results: [...quizRows.values()].map((row) => ({
                quiz_id: row.quizId,
                question_id: row.id,
                question: row.question,
                options_json: JSON.stringify(row.options),
                correct_index: row.correctIndex,
                explanation: row.explanation,
                updated_at: "2026-07-17 00:00:00",
              })),
            };
          }
          return {
            results: [...rows.values()].map((row) => ({
              lesson_id: row.lessonId,
              card_id: row.id,
              question: row.question,
              answer: row.answer,
              updated_at: "2026-07-16 00:00:00",
            })),
          };
        },
        async run() {
          if (/INSERT INTO flashcard_overrides/.test(query)) {
            const [lessonId, id, question, answer] = values;
            rows.set(`${lessonId}-${id}`, { lessonId, id, question, answer });
          } else if (/DELETE FROM flashcard_overrides/.test(query)) {
            rows.delete(`${values[0]}-${values[1]}`);
          } else if (/INSERT INTO quiz_overrides/.test(query)) {
            const [quizId, id, question, optionsJson, correctIndex, explanation] = values;
            quizRows.set(`${quizId}-${id}`, {
              quizId,
              id,
              question,
              options: JSON.parse(optionsJson),
              correctIndex,
              explanation,
            });
          } else if (/DELETE FROM quiz_overrides/.test(query)) {
            quizRows.delete(`${values[0]}-${values[1]}`);
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

function request(path, init = {}) {
  return new Request(`https://ensuku-basic-flashcards.kobotenmitsu.chatgpt.site${path}`, init);
}

test("admin login rejects a wrong password and accepts the configured secret", async () => {
  const env = { ADMIN_PASSWORD: "test-only-secret", DB: mockDb() };
  const wrong = await handleAdminApi(request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  }), env);
  assert.equal(wrong.status, 401);

  const correct = await handleAdminApi(request("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-only-secret" }),
  }), env);
  assert.equal(correct.status, 200);
  assert.deepEqual(await correct.json(), { ok: true });
});

test("admin can save, publish, and restore a card override", async () => {
  const DB = mockDb();
  const env = { ADMIN_PASSWORD: "test-only-secret", DB };
  const headers = {
    "Content-Type": "application/json",
    "X-Admin-Password": "test-only-secret",
  };

  const saved = await handleAdminApi(request("/api/admin/cards/tenten/24", {
    method: "PUT",
    headers,
    body: JSON.stringify({ question: "編集後の問題", answer: "編集後の解答" }),
  }), env);
  assert.equal(saved.status, 200);

  const listed = await handleAdminApi(request("/api/cards"), env);
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).overrides[0], {
    lessonId: "tenten",
    id: 24,
    question: "編集後の問題",
    answer: "編集後の解答",
    updatedAt: "2026-07-16 00:00:00",
  });

  const restored = await handleAdminApi(request("/api/admin/cards/tenten/24", {
    method: "DELETE",
    headers,
  }), env);
  assert.equal(restored.status, 200);
  assert.equal(DB.rows.size, 0);
});

test("admin can save, publish, and restore a four-choice quiz override", async () => {
  const DB = mockDb();
  const env = { ADMIN_PASSWORD: "test-only-secret", DB };
  const headers = {
    "Content-Type": "application/json",
    "X-Admin-Password": "test-only-secret",
  };
  const editedQuestion = {
    question: "編集後の4択問題",
    options: ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
    correctIndex: 2,
    explanation: "編集後の解説",
  };

  const saved = await handleAdminApi(request("/api/admin/quizzes/basic-order-2026-07-16/3", {
    method: "PUT",
    headers,
    body: JSON.stringify(editedQuestion),
  }), env);
  assert.equal(saved.status, 200);

  const listed = await handleAdminApi(request("/api/cards"), env);
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).quizOverrides[0], {
    quizId: "basic-order-2026-07-16",
    id: 3,
    ...editedQuestion,
    updatedAt: "2026-07-17 00:00:00",
  });

  const restored = await handleAdminApi(request("/api/admin/quizzes/basic-order-2026-07-16/3", {
    method: "DELETE",
    headers,
  }), env);
  assert.equal(restored.status, 200);
  assert.equal(DB.quizRows.size, 0);
});

test("quiz writes require authentication and valid complete choices", async () => {
  const env = { ADMIN_PASSWORD: "test-only-secret", DB: mockDb() };
  const path = "/api/admin/quizzes/basic-order-2026-07-16/1";
  const unauthorized = await handleAdminApi(request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "問題", options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "解説" }),
  }), env);
  assert.equal(unauthorized.status, 401);

  const invalid = await handleAdminApi(request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Admin-Password": "test-only-secret" },
    body: JSON.stringify({ question: "問題", options: ["A", "B", ""], correctIndex: 4, explanation: "" }),
  }), env);
  assert.equal(invalid.status, 400);

  const forbiddenOrigin = await handleAdminApi(new Request(
    `https://ensuku-basic-flashcards.kobotenmitsu.chatgpt.site${path}`,
    { method: "DELETE", headers: { Origin: "https://example.com", "X-Admin-Password": "test-only-secret" } },
  ), env);
  assert.equal(forbiddenOrigin.status, 403);
});
