import {
  FLASHCARD_ADDITIONS_SCHEMA_SQL,
  LESSON_TITLES_SCHEMA_SQL,
  LESSON_TITLES_MIGRATION_SQL,
  LESSON_RESOURCES_SCHEMA_SQL,
  CUSTOM_LESSON_CARDS_SCHEMA_SQL,
  FLASHCARD_ORDER_SCHEMA_SQL,
  FLASHCARD_OVERRIDES_LEGACY_COPY_SQL,
  FLASHCARD_OVERRIDES_SCHEMA_SQL,
  QUIZ_OVERRIDES_SCHEMA_SQL,
} from "../db/schema.mjs";

const CARD_LIMITS = Object.freeze({ tenten0718: 30, tenten: 50, nejimaki: 50 });
const LESSON_IDS = new Set(Object.keys(CARD_LIMITS));
const QUIZ_ID = "basic-order-2026-07-16";
function isTrustedOrigin(origin) {
  if (!origin) return true;
  return /^https?:\/\//i.test(origin);
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Headers": "content-type",
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

async function ensureSchema(db) {
  await db.prepare(FLASHCARD_OVERRIDES_SCHEMA_SQL).run();
  try {
    await db.prepare(FLASHCARD_OVERRIDES_LEGACY_COPY_SQL).run();
  } catch {
    // 新規DBには旧テーブルがないため、移行処理だけを読み飛ばす。
  }
  await db.prepare(FLASHCARD_ADDITIONS_SCHEMA_SQL).run();
  await db.prepare(LESSON_TITLES_SCHEMA_SQL).run();
  for (const statement of LESSON_TITLES_MIGRATION_SQL) {
    try { await db.prepare(statement).run(); } catch { /* already migrated */ }
  }
  await db.prepare(LESSON_RESOURCES_SCHEMA_SQL).run();
  await db.prepare(CUSTOM_LESSON_CARDS_SCHEMA_SQL).run();
  await db.prepare(FLASHCARD_ORDER_SCHEMA_SQL).run();
  await db.prepare(QUIZ_OVERRIDES_SCHEMA_SQL).run();
}

function parseCardPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/cards\/([^/]+)\/(\d+)(\/delete)?$/);
  if (!match) return null;
  const limit = CARD_LIMITS[match[1]];
  const cardId = Number(match[2]);
  if (!limit || !Number.isInteger(cardId) || cardId < 1 || cardId > 10000) return null;
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
    || url.pathname === "/api/admin/lessons"
    || url.pathname.startsWith("/api/admin/lessons/")
    || url.pathname.startsWith("/api/admin/quizzes/")
    || url.pathname === "/api/images"
    || url.pathname.startsWith("/api/images/");
  if (!isApiPath) return null;

  if (!isTrustedOrigin(request.headers.get("origin"))) {
    return json(request, { error: "許可されていない接続元です。" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    return json(request, { ok: true, publicEditor: true });
  }

  if (url.pathname === "/api/images" && request.method === "POST") {
    if (!env.MEDIA) return json(request, { error: "画像保存を利用できません。" }, 503);
    const type = request.headers.get("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    const extension = extensions[type];
    const bytes = await request.arrayBuffer();
    if (!extension || !bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) {
      return json(request, { error: "PNG・JPEG・WebP・GIFの8MB以下の画像を選んでください。" }, 400);
    }
    const key = `card-images/${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } });
    return json(request, { ok: true, url: `${url.origin}/api/images/${key}` });
  }

  const imageMatch = url.pathname.match(/^\/api\/images\/(card-images\/[a-f0-9-]+\.(?:jpg|png|webp|gif))$/i);
  if (imageMatch && request.method === "GET") {
    if (!env.MEDIA) return json(request, { error: "画像保存を利用できません。" }, 503);
    const object = await env.MEDIA.get(imageMatch[1]);
    if (!object) return json(request, { error: "画像が見つかりません。" }, 404);
    const headers = corsHeaders(request);
    headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  }

  if (!env.DB) {
    return json(request, { error: "問題データベースが利用できません。" }, 503);
  }
  await ensureSchema(env.DB);

  if (url.pathname === "/api/cards" && request.method === "GET") {
    const cardResult = await env.DB.prepare(
      "SELECT lesson_id, card_id, question, answer, deleted, updated_at FROM flashcard_overrides_v2 ORDER BY lesson_id, card_id",
    ).all();
    const additionResult = await env.DB.prepare(
      "SELECT lesson_id, card_id, question, answer, deleted, updated_at FROM flashcard_additions ORDER BY lesson_id, card_id",
    ).all();
    const quizResult = await env.DB.prepare(
      "SELECT quiz_id, question_id, question, options_json, correct_index, explanation, deleted, updated_at FROM quiz_overrides ORDER BY quiz_id, question_id",
    ).all();
    const lessonResult = await env.DB.prepare(
      "SELECT lesson_id, lesson_date, teacher, title, video_url, deleted, sort_order FROM lesson_titles WHERE deleted = 0 ORDER BY sort_order, lesson_date DESC, created_at DESC",
    ).all();
    const resourceResult = await env.DB.prepare(
      "SELECT resource_id, lesson_id, kind, label, url, sort_order FROM lesson_resources ORDER BY lesson_id, sort_order, created_at",
    ).all();
    const customCardResult = await env.DB.prepare(
      "SELECT lesson_id, card_id, question, answer FROM custom_lesson_cards ORDER BY lesson_id, card_id",
    ).all();
    const orderResult = await env.DB.prepare(
      "SELECT lesson_id, card_id, sort_order FROM flashcard_order ORDER BY lesson_id, sort_order, card_id",
    ).all();
    const overrides = [...(cardResult.results ?? []).map((row) => ({
      lessonId: row.lesson_id,
      id: row.card_id,
      question: row.question,
      answer: row.answer,
      ...(row.deleted === 1 ? { deleted: true } : {}),
      updatedAt: row.updated_at,
    })), ...(additionResult.results ?? []).map((row) => ({
      lessonId: row.lesson_id,
      id: row.card_id,
      question: row.question,
      answer: row.answer,
      added: true,
      ...(row.deleted === 1 ? { deleted: true } : {}),
      updatedAt: row.updated_at,
    }))];
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
    const lessons = (lessonResult.results ?? []).map((row) => ({
      id: row.lesson_id,
      date: row.lesson_date,
      teacher: row.teacher,
      title: row.title,
      videoUrl: row.video_url,
      sortOrder: row.sort_order,
    }));
    const resources = (resourceResult.results ?? []).map((row) => ({
      id: row.resource_id,
      lessonId: row.lesson_id,
      kind: row.kind,
      label: row.label,
      url: row.url,
    }));
    const customCards = (customCardResult.results ?? []).map((row) => ({
      lessonId: row.lesson_id,
      id: row.card_id,
      question: row.question,
      answer: row.answer,
    }));
    const cardOrders = (orderResult.results ?? []).map((row) => ({ lessonId: row.lesson_id, id: row.card_id, sortOrder: row.sort_order }));
    return json(request, { overrides, quizOverrides, lessons, resources, customCards, cardOrders });
  }

  if (url.pathname === "/api/admin/lessons" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const teacher = typeof body?.teacher === "string" ? body.teacher.trim() : "";
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
    const resources = Array.isArray(body?.resources) ? body.resources : [];
    if (!date || !teacher || !title) return json(request, { error: "日付・先生名・授業タイトルを入力してください。" }, 400);
    if (date.length > 40 || teacher.length > 80 || title.length > 200 || videoUrl.length > 2000) {
      return json(request, { error: "入力内容が長すぎます。" }, 400);
    }
    if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return json(request, { error: "動画URLは https:// または http:// で入力してください。" }, 400);
    const id = `lesson-${crypto.randomUUID()}`;
    const maxOrder = await env.DB.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM lesson_titles WHERE deleted = 0").all();
    const sortOrder = Number(maxOrder.results?.[0]?.max_order ?? -1) + 1;
    await env.DB.prepare(
      "INSERT INTO lesson_titles (lesson_id, lesson_date, teacher, title, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, date, teacher, title, videoUrl, sortOrder).run();
    for (let index = 0; index < resources.length; index += 1) {
      const resource = resources[index];
      const kind = resource?.kind === "image" ? "image" : "link";
      const url = typeof resource?.url === "string" ? resource.url.trim() : "";
      const label = typeof resource?.label === "string" ? resource.label.trim() : "";
      if (!url || !/^https?:\/\//i.test(url)) continue;
      await env.DB.prepare(
        "INSERT INTO lesson_resources (resource_id, lesson_id, kind, label, url, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(`resource-${crypto.randomUUID()}`, id, kind, label.slice(0, 160), url, index).run();
    }
    return json(request, { ok: true, lesson: { id, date, teacher, title, videoUrl, sortOrder } });
  }

  const lessonPath = url.pathname.match(/^\/api\/admin\/lessons\/([^/]+)$/i);
  if (lessonPath && lessonPath[1].toLowerCase() !== "order") {
    const lessonId = lessonPath[1];
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch { body = {}; }
      const date = typeof body?.date === "string" ? body.date.trim() : "";
      const teacher = typeof body?.teacher === "string" ? body.teacher.trim() : "";
      const title = typeof body?.title === "string" ? body.title.trim() : "";
      const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl.trim() : "";
      if (!date || !teacher || !title) return json(request, { error: "日付・先生名・授業タイトルを入力してください。" }, 400);
      if (videoUrl && !/^https?:\/\//i.test(videoUrl)) return json(request, { error: "動画URLは https:// または http:// で入力してください。" }, 400);
      await env.DB.prepare(`
        INSERT INTO lesson_titles (lesson_id, lesson_date, teacher, title, video_url, deleted, sort_order)
        VALUES (?, ?, ?, ?, ?, 0, COALESCE((SELECT sort_order FROM lesson_titles WHERE lesson_id = ?), 0))
        ON CONFLICT(lesson_id) DO UPDATE SET lesson_date = excluded.lesson_date, teacher = excluded.teacher, title = excluded.title, video_url = excluded.video_url, deleted = 0
      `).bind(lessonId, date, teacher, title, videoUrl, lessonId).run();
      return json(request, { ok: true, lesson: { id: lessonId, date, teacher, title, videoUrl } });
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("UPDATE lesson_titles SET deleted = 1 WHERE lesson_id = ?").bind(lessonId).run();
      return json(request, { ok: true, deleted: true });
    }
    return json(request, { error: "対応していない操作です。" }, 405);
  }

  if (url.pathname === "/api/admin/lessons/order" && request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const lessonIds = Array.isArray(body?.lessonIds) ? body.lessonIds.filter((id) => typeof id === "string" && id.length <= 200) : [];
    if (!lessonIds.length || new Set(lessonIds).size !== lessonIds.length) return json(request, { error: "授業の並び順が正しくありません。" }, 400);
    for (let index = 0; index < lessonIds.length; index += 1) {
      await env.DB.prepare("UPDATE lesson_titles SET sort_order = ? WHERE lesson_id = ?").bind(index, lessonIds[index]).run();
    }
    return json(request, { ok: true, lessonIds });
  }

  const orderPath = url.pathname.match(/^\/api\/admin\/(?:cards\/(tenten0718|tenten|nejimaki)|lessons\/(lesson-[a-f0-9-]+)\/cards)\/order$/i);
  if (orderPath) {
    if (request.method !== "PUT") return json(request, { error: "対応していない操作です。" }, 405);
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const cardIds = Array.isArray(body?.cardIds) ? body.cardIds : [];
    if (!cardIds.length || cardIds.length > 10000 || cardIds.some((id) => !Number.isInteger(id) || id < 1 || id > 10000) || new Set(cardIds).size !== cardIds.length) {
      return json(request, { error: "問題の並び順が正しくありません。" }, 400);
    }
    const lessonId = orderPath[1] ?? orderPath[2];
    await env.DB.prepare("DELETE FROM flashcard_order WHERE lesson_id = ?").bind(lessonId).run();
    for (let index = 0; index < cardIds.length; index += 1) {
      await env.DB.prepare("INSERT INTO flashcard_order (lesson_id, card_id, sort_order) VALUES (?, ?, ?)").bind(lessonId, cardIds[index], index + 1).run();
    }
    return json(request, { ok: true, cardIds });
  }

  const customCardPath = url.pathname.match(/^\/api\/admin\/lessons\/(lesson-[a-f0-9-]+)\/cards(?:\/(\d+))?$/i);
  if (customCardPath) {
    const lessonId = customCardPath[1];
    const cardId = customCardPath[2] ? Number(customCardPath[2]) : 0;
    if (request.method === "POST" && !cardId) {
      const next = await env.DB.prepare(
        "SELECT COALESCE(MAX(card_id), 0) + 1 AS next_id FROM custom_lesson_cards WHERE lesson_id = ?",
      ).bind(lessonId).all();
      const nextId = Number(next.results?.[0]?.next_id ?? 1);
      await env.DB.prepare(
        "INSERT INTO custom_lesson_cards (lesson_id, card_id, question, answer) VALUES (?, ?, ?, ?)",
      ).bind(lessonId, nextId, "新しい問題", "解答を入力してください。").run();
      return json(request, { ok: true, card: { id: nextId, question: "新しい問題", answer: "解答を入力してください。" } });
    }
    if (!cardId) return json(request, { error: "問題番号が不正です。" }, 404);
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); } catch { body = {}; }
      const question = typeof body?.question === "string" ? body.question.trim() : "";
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!question || !answer) return json(request, { error: "問題文と解答文を入力してください。" }, 400);
      await env.DB.prepare(`
        INSERT INTO custom_lesson_cards (lesson_id, card_id, question, answer, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(lesson_id, card_id) DO UPDATE SET question = excluded.question, answer = excluded.answer, updated_at = CURRENT_TIMESTAMP
      `).bind(lessonId, cardId, question, answer).run();
      return json(request, { ok: true, card: { id: cardId, question, answer } });
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM custom_lesson_cards WHERE lesson_id = ? AND card_id = ?").bind(lessonId, cardId).run();
      return json(request, { ok: true });
    }
    return json(request, { error: "対応していない操作です。" }, 405);
  }

  const quizPath = parseQuizPath(url.pathname);
  if (quizPath) {
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

  const cardCollection = url.pathname.match(/^\/api\/admin\/cards\/([^/]+)$/);
  if (cardCollection && request.method === "POST" && LESSON_IDS.has(cardCollection[1])) {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const question = typeof body?.question === "string" ? body.question.trim() : "新しい問題";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "解答を入力してください。";
    if (!question || !answer) return json(request, { error: "問題文と解答文を入力してください。" }, 400);
    if (question.length > 2000 || answer.length > 5000) return json(request, { error: "文章が長すぎます。" }, 400);
    const next = await env.DB.prepare(
      "SELECT COALESCE(MAX(card_id), 50) + 1 AS next_id FROM flashcard_additions WHERE lesson_id = ?",
    ).bind(cardCollection[1]).all();
    const cardId = Math.max(CARD_LIMITS[cardCollection[1]] + 1, Number(next.results?.[0]?.next_id ?? CARD_LIMITS[cardCollection[1]] + 1));
    await env.DB.prepare(
      "INSERT INTO flashcard_additions (lesson_id, card_id, question, answer) VALUES (?, ?, ?, ?)",
    ).bind(cardCollection[1], cardId, question, answer).run();
    return json(request, { ok: true, card: { id: cardId, question, answer, added: true } });
  }

  const cardPath = parseCardPath(url.pathname);
  if (!cardPath || !LESSON_IDS.has(cardPath.lessonId)) {
    return json(request, { error: "対象の問題が見つかりません。" }, 404);
  }

  if (cardPath.deleteProblem) {
    if (request.method !== "DELETE") {
      return json(request, { error: "対応していない操作です。" }, 405);
    }
    const statement = env.DB.prepare(cardPath.cardId > CARD_LIMITS[cardPath.lessonId] ? `
      INSERT INTO flashcard_additions (lesson_id, card_id, question, answer, deleted, updated_at)
      VALUES (?, ?, '', '', 1, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET deleted = 1, updated_at = CURRENT_TIMESTAMP
    ` : `
      INSERT INTO flashcard_overrides_v2 (lesson_id, card_id, question, answer, deleted, updated_at)
      VALUES (?, ?, '', '', 1, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET question = '', answer = '', deleted = 1, updated_at = CURRENT_TIMESTAMP
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
    const statement = env.DB.prepare(cardPath.cardId > CARD_LIMITS[cardPath.lessonId] ? `
      INSERT INTO flashcard_additions (lesson_id, card_id, question, answer, deleted, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(lesson_id, card_id) DO UPDATE SET question = excluded.question, answer = excluded.answer, deleted = 0, updated_at = CURRENT_TIMESTAMP
    ` : `
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
    const statement = env.DB.prepare(cardPath.cardId > CARD_LIMITS[cardPath.lessonId]
      ? "DELETE FROM flashcard_additions WHERE lesson_id = ? AND card_id = ?"
      : "DELETE FROM flashcard_overrides_v2 WHERE lesson_id = ? AND card_id = ?");
    await statement.bind(cardPath.lessonId, cardPath.cardId).run();
    return json(request, { ok: true });
  }


  return json(request, { error: "対応していない操作です。" }, 405);
}
