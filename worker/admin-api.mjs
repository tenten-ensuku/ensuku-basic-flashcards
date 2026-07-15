import { FLASHCARD_OVERRIDES_SCHEMA_SQL } from "../db/schema.mjs";

const LESSON_IDS = new Set(["tenten", "nejimaki"]);
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
}

function parseCardPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/cards\/(tenten|nejimaki)\/(\d+)$/);
  if (!match) return null;
  const cardId = Number(match[2]);
  if (!Number.isInteger(cardId) || cardId < 1 || cardId > 50) return null;
  return { lessonId: match[1], cardId };
}

export async function handleAdminApi(request, env) {
  const url = new URL(request.url);
  const isApiPath = url.pathname === "/api/cards"
    || url.pathname === "/api/admin/login"
    || url.pathname.startsWith("/api/admin/cards/");
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
    const result = await env.DB.prepare(
      "SELECT lesson_id, card_id, question, answer, updated_at FROM flashcard_overrides ORDER BY lesson_id, card_id",
    ).all();
    const overrides = (result.results ?? []).map((row) => ({
      lessonId: row.lesson_id,
      id: row.card_id,
      question: row.question,
      answer: row.answer,
      updatedAt: row.updated_at,
    }));
    return json(request, { overrides });
  }

  const cardPath = parseCardPath(url.pathname);
  if (!cardPath || !LESSON_IDS.has(cardPath.lessonId)) {
    return json(request, { error: "対象の問題が見つかりません。" }, 404);
  }
  if (!hasValidPassword(request, env)) {
    return json(request, { error: "管理パスワードを確認してください。" }, 401);
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
      INSERT INTO flashcard_overrides (lesson_id, card_id, question, answer, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET
        question = excluded.question,
        answer = excluded.answer,
        updated_at = CURRENT_TIMESTAMP
    `);
    await statement.bind(cardPath.lessonId, cardPath.cardId, question, answer).run();
    return json(request, { ok: true, card: { id: cardPath.cardId, question, answer } });
  }

  if (request.method === "DELETE") {
    const statement = env.DB.prepare(
      "DELETE FROM flashcard_overrides WHERE lesson_id = ? AND card_id = ?",
    );
    await statement.bind(cardPath.lessonId, cardPath.cardId).run();
    return json(request, { ok: true });
  }

  return json(request, { error: "対応していない操作です。" }, 405);
}
