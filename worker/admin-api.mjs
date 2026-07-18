import {
  FLASHCARD_OVERRIDES_LEGACY_COPY_SQL,
  FLASHCARD_OVERRIDES_SCHEMA_SQL,
  QUIZ_OVERRIDES_SCHEMA_SQL,
} from "../db/schema.mjs";

const CARD_LIMITS = Object.freeze({ tenten0718: 30, tenten: 50, nejimaki: 50 });
const LESSON_IDS = new Set(Object.keys(CARD_LIMITS));
const QUIZ_ID = "basic-order-2026-07-16";
const TRUSTED_ORIGINS = new Set([
  "https://tenten-ensuku.github.io",
  "https://ensuku-basic-flashcards.kobotenmitsu.chatgpt.site",
]);

function isTrustedOrigin(origin) {
  if (!origin) return true;
  if (TRUSTED_ORIGINS.has(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Headers": "content-type, x-admin-password",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  });
  if (origin && isTrustedOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(request, value, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { status, headers });
}

function hasValidPassword(request, env, bodyPassword = "") {
  const supplied = request.headers.get("x-admin-password") ?? bodyPassword;
  return Boolean(env.ADMIN_PASSWORD) && supplied === env.ADMIN_PASSWORD;
}

async function ensureSchema(db) {
  await db.prepare(FLASHCARD_OVERRIDES_SCHEMA_SQL).run();
  try {
    await db.prepare(FLASHCARD_OVERRIDES_LEGACY_COPY_SQL).run();
  } catch {
    // 新規DBには旧テーブルがないため、移行処理だけを読み飛ばす。
  }
  await db.prepare(QUIZ_OVERRIDES_SCHEMA_SQL).run();
}

function parseCardPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/cards\/([^/]+)\/(\d+)(\/delete)?$/);
  if (!match) return null;
  const limit = CARD_LIMITS[match[1]];
  const cardId = Number(match[2]);
  if (!limit || !Number.isInteger(cardId) || cardId < 1 || cardId > limit) return null;
  return { lessonId: match[1], cardId, deleteProblem: Boolean(match[3]) };
}

function parseQuizPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/quizzes\/basic-order-2026-07-16\/(\d+)(\/delete)?$/);
  if (!match) return null;
  const questionId = Number(match[1]);
  if (!Number.isInteger(questionId) || questionId < 1 || questionId > 30) return null;
  return { quizId: QUIZ_ID, questionId, deleteProblem: Boolean(match[2]) };
}

export async function handleAdminApi(request, env) {
  const url = new URL(request.url);
  const isApiPath = url.pathname === "/api/cards"
    || url.pathname === "/api/admin/login"
    || url.pathname.startsWith("/api/admin/cards/")
    || url.pathname.startsWith("/api/admin/quizzes/");
  if (!isApiPath) return null;

  if (!isTrustedOrigin(request.headers.get("origin"))) {
    return json(request, { error: "許可されていない接続元です。" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) {
      return json(request, { error: "管理機能が設定されていません。" }, 503);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: "入力内容を確認してください。" }, 400);
    }
    if (!hasValidPassword(request, env, typeof body?.password === "string" ? body.password : "")) {
      return json(request, { error: "パスワードが違います。" }, 401);
    }
    return json(request, { ok: true });
  }

  if (!env.DB) {
    return json(request, { error: "問題データベースが利用できません。" }, 503);
  }
  await ensureSchema(env.DB);

  if (url.pathname === "/api/cards" && request.method === "GET") {
    const cardResult = await env.DB.prepare(
      "SELECT lesson_id, card_id, question, answer, deleted, updated_at FROM flashcard_overrides_v2 ORDER BY lesson_id, card_id",
    ).all();
    const quizResult = await env.DB.prepare(
      "SELECT quiz_id, question_id, question, options_json, correct_index, explanation, deleted, updated_at FROM quiz_overrides ORDER BY quiz_id, question_id",
    ).all();
    const overrides = (cardResult.results ?? []).map((row) => ({
      lessonId: row.lesson_id,
      id: row.card_id,
      question: row.question,
      answer: row.answer,
      ...(row.deleted === 1 ? { deleted: true } : {}),
      updatedAt: row.updated_at,
    }));
    const quizOverrides = (quizResult.results ?? []).flatMap((row) => {
      try {
        const options = JSON.parse(row.options_json);
        if (!Array.isArray(options) || options.length !== 4 || options.some((option) => typeof option !== "string")) {
          return [];
        }
        return [{
          quizId: row.quiz_id,
          id: row.question_id,
          question: row.question,
          options,
          correctIndex: row.correct_index,
          explanation: row.explanation,
          ...(row.deleted === 1 ? { deleted: true } : {}),
          updatedAt: row.updated_at,
        }];
      } catch {
        return [];
      }
    });
    return json(request, { overrides, quizOverrides });
  }

  const quizPath = parseQuizPath(url.pathname);
  if (quizPath) {
    if (!hasValidPassword(request, env)) {
      return json(request, { error: "管理パスワードを確認してください。" }, 401);
    }
    if (quizPath.deleteProblem) {
      if (request.method !== "DELETE") {
        return json(request, { error: "対応していない操作です。" }, 405);
      }
      const statement = env.DB.prepare(`
        INSERT INTO quiz_overrides (
          quiz_id, question_id, question, options_json, correct_index, explanation, deleted, updated_at
        ) VALUES (?, ?, '', '["", "", "", ""]', 0, '', 1, CURRENT_TIMESTAMP)
        ON CONFLICT(quiz_id, question_id) DO UPDATE SET
          question = '',
          options_json = '["", "", "", ""]',
          correct_index = 0,
          explanation = '',
          deleted = 1,
          updated_at = CURRENT_TIMESTAMP
      `);
      await statement.bind(quizPath.quizId, quizPath.questionId).run();
      return json(request, { ok: true, deleted: true });
    }
    if (request.method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json(request, { error: "入力内容を確認してください。" }, 400);
      }
      const question = typeof body?.question === "string" ? body.question.trim() : "";
      const options = Array.isArray(body?.options)
        ? body.options.map((option) => typeof option === "string" ? option.trim() : "")
        : [];
      const correctIndex = body?.correctIndex;
      const explanation = typeof body?.explanation === "string" ? body.explanation.trim() : "";
      if (!question || options.length !== 4 || options.some((option) => !option) || !explanation) {
        return json(request, { error: "問題文・4つの選択肢・解説をすべて入力してください。" }, 400);
      }
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
        return json(request, { error: "正解をA〜Dから選択してください。" }, 400);
      }
      if (question.length > 2000 || options.some((option) => option.length > 1000) || explanation.length > 5000) {
        return json(request, { error: "文章が長すぎます。" }, 400);
      }
      const statement = env.DB.prepare(`
        INSERT INTO quiz_overrides (
          quiz_id, question_id, question, options_json, correct_index, explanation, deleted, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(quiz_id, question_id) DO UPDATE SET
          question = excluded.question,
          options_json = excluded.options_json,
          correct_index = excluded.correct_index,
          explanation = excluded.explanation,
          deleted = 0,
          updated_at = CURRENT_TIMESTAMP
      `);
      await statement.bind(
        quizPath.quizId,
        quizPath.questionId,
        question,
        JSON.stringify(options),
        correctIndex,
        explanation,
      ).run();
      return json(request, {
        ok: true,
        question: { id: quizPath.questionId, question, options, correctIndex, explanation },
      });
    }
    if (request.method === "DELETE") {
      const statement = env.DB.prepare(
        "DELETE FROM quiz_overrides WHERE quiz_id = ? AND question_id = ?",
      );
      await statement.bind(quizPath.quizId, quizPath.questionId).run();
      return json(request, { ok: true });
    }
    return json(request, { error: "対応していない操作です。" }, 405);
  }

  const cardPath = parseCardPath(url.pathname);
  if (!cardPath || !LESSON_IDS.has(cardPath.lessonId)) {
    return json(request, { error: "対象の問題が見つかりません。" }, 404);
  }
  if (!hasValidPassword(request, env)) {
    return json(request, { error: "管理パスワードを確認してください。" }, 401);
  }

  if (cardPath.deleteProblem) {
    if (request.method !== "DELETE") {
      return json(request, { error: "対応していない操作です。" }, 405);
    }
    const statement = env.DB.prepare(`
      INSERT INTO flashcard_overrides_v2 (lesson_id, card_id, question, answer, deleted, updated_at)
      VALUES (?, ?, '', '', 1, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET
        question = '',
        answer = '',
        deleted = 1,
        updated_at = CURRENT_TIMESTAMP
    `);
    await statement.bind(cardPath.lessonId, cardPath.cardId).run();
    return json(request, { ok: true, deleted: true });
  }

  if (request.method === "PUT") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json(request, { error: "入力内容を確認してください。" }, 400);
    }
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    if (!question || !answer) {
      return json(request, { error: "問題文と解答文を入力してください。" }, 400);
    }
    if (question.length > 2000 || answer.length > 5000) {
      return json(request, { error: "文章が長すぎます。" }, 400);
    }
    const statement = env.DB.prepare(`
      INSERT INTO flashcard_overrides_v2 (lesson_id, card_id, question, answer, deleted, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET
        question = excluded.question,
        answer = excluded.answer,
        deleted = 0,
        updated_at = CURRENT_TIMESTAMP
    `);
    await statement.bind(cardPath.lessonId, cardPath.cardId, question, answer).run();
    return json(request, { ok: true, card: { id: cardPath.cardId, question, answer } });
  }

  if (request.method === "DELETE") {
    const statement = env.DB.prepare(
      "DELETE FROM flashcard_overrides_v2 WHERE lesson_id = ? AND card_id = ?",
    );
    await statement.bind(cardPath.lessonId, cardPath.cardId).run();
    return json(request, { ok: true });
  }

  return json(request, { error: "対応していない操作です。" }, 405);
}
