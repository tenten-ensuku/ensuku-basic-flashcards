"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APP_VERSION,
  APP_ANNOUNCEMENTS,
  LEGACY_STORAGE_KEY,
  LESSONS,
  STORAGE_KEY,
  formatDuration,
  getRank,
  mergeFlashcardOverrides,
  readProgress,
  updateReviewIds,
} from "./lib/flashcards.mjs";
import {
  BASIC_ORDER_QUIZ,
  QUIZ_LESSON,
  QUIZ_STORAGE_KEY,
  choiceLabel,
  mergeQuizOverrides,
  readQuizProgress,
  scoreQuiz,
} from "./lib/quiz.mjs";
import { tokenizeRichText } from "./lib/rich-text.mjs";

type Screen = "home" | "session" | "result" | "list" | "favorites" | "quiz" | "quiz-list" | "quiz-result" | "admin-login" | "admin";
type SessionMode = "all" | "review";
type Rating = "known" | "again";
type SessionEditField = "question" | "answer" | null;
type ListEditDraft = Flashcard | null;
type BaseLessonId = keyof typeof LESSONS;
type LessonId = BaseLessonId | string;
type Flashcard = { id: number; question: string; answer: string };
type SessionFlashcard = Flashcard & { sourceLessonId?: LessonId; sourceCardId?: number };
type CardsByLesson = Record<string, Flashcard[]>;
type CardOverride = Flashcard & { lessonId: BaseLessonId; deleted?: boolean };
type AddedLesson = { id: string; date: string; teacher: string; title: string; videoUrl: string; sortOrder?: number };
type LessonResource = { id: string; lessonId: string; kind: "image" | "link"; label: string; url: string };
type QuizQuestion = {
  id: number;
  chapter: string;
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
};
type QuizOverride = Omit<QuizQuestion, "chapter"> & { quizId: string; deleted?: boolean };
type AdminSection = BaseLessonId | "quiz";
type HomeSectionId = LessonId | "quiz";
type QuizAnswer = {
  questionId: number;
  selectedIndex: number;
  correct: boolean;
};
type SavedQuizSession = {
  questionIds: number[];
  currentIndex: number;
  answers: Array<{ questionId: number; selectedIndex: number }>;
  elapsedSeconds: number;
  updatedAt: string;
};
type ReviewCardIdsByLesson = Record<string, number[]>;
type FavoriteCardIdsByLesson = Record<string, number[]>;
type AppTone = "mint" | "sky" | "lavender" | "sunset";
type DeletedCardIdsByLesson = Record<BaseLessonId, number[]>;
type LastSession = {
  lessonId: LessonId;
  mode: SessionMode;
  count: number;
  known: number;
  again: number;
  rate: number;
  rank: string;
  elapsedSeconds: number;
  completedAt: string;
};
type SavedFlashcardSession = {
  lessonId: LessonId;
  mode: SessionMode;
  cardIds: number[];
  currentIndex: number;
  revealed: boolean;
  ratings: Record<string, Rating>;
  elapsedSeconds: number;
  updatedAt: string;
};

function modeLabel(mode: SessionMode, count: number) {
  return mode === "all" ? `全${count}問` : "解き直しカード";
}

const ADMIN_SECTIONS: ReadonlyArray<{ id: AdminSection; label: string }> = [
  { id: "tenten0718", label: "7/18　てんてん先生" },
  { id: "quiz", label: "7/16　4択クイズ" },
  { id: "tenten", label: "7/14　てんてん先生" },
  { id: "nejimaki", label: "7/2　ねじまき鳥先生" },
];

type Suit = "m" | "p" | "s";

const SUITS: Record<Suit, { prefix: string; label: string }> = {
  m: { prefix: "man", label: "萬" },
  p: { prefix: "pin", label: "筒" },
  s: { prefix: "sou", label: "索" },
};

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const ADMIN_API_BASE_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? "";
const DEFAULT_APP_ICON_URL = `${BASE_PATH}/icons/serina.png`;
const DEFAULT_APP_TITLE = "授業復習～瀬利さりな～";
const FAVORITES_SESSION_ID = "__favorites__";
const APPEARANCE_STORAGE_KEY = "ensuku-basic-flashcards-appearance-v1";
const IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*\]\([^)]+\)/;
const BASE_LESSON_METADATA: Record<BaseLessonId, AddedLesson> = {
  tenten0718: { id: "tenten0718", date: "7/18", teacher: "てんてん先生", title: "6枚形+完全形何切る？", videoUrl: LESSONS.tenten0718.videoUrl },
  tenten: { id: "tenten", date: "7/14", teacher: "てんてん先生", title: "基礎講義復習", videoUrl: LESSONS.tenten.videoUrl },
  nejimaki: { id: "nejimaki", date: "7/2", teacher: "ねじまき鳥先生", title: "基礎講義②", videoUrl: LESSONS.nejimaki.videoUrl },
};

function favoriteSessionCardId(lessonId: string, cardId: number) {
  let hash = 0;
  for (const character of lessonId) hash = ((hash * 31) + character.charCodeAt(0)) % 1_000_000;
  return (hash * 1_000_000_000) + cardId;
}

function cloneBaseCards(): CardsByLesson {
  return {
    tenten0718: LESSONS.tenten0718.cards.map((card) => ({ ...card })),
    tenten: LESSONS.tenten.cards.map((card) => ({ ...card })),
    nejimaki: LESSONS.nejimaki.cards.map((card) => ({ ...card })),
  };
}

function orderCards(cards: Flashcard[], order: number[] = []) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...cards].sort((left, right) => (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER) || left.id - right.id);
}

function withOverrides(overrides: CardOverride[]): CardsByLesson {
  return {
    tenten0718: mergeFlashcardOverrides(LESSONS.tenten0718.cards, overrides, "tenten0718"),
    tenten: mergeFlashcardOverrides(LESSONS.tenten.cards, overrides, "tenten"),
    nejimaki: mergeFlashcardOverrides(LESSONS.nejimaki.cards, overrides, "nejimaki"),
  } as CardsByLesson;
}

function cloneBaseQuiz(): QuizQuestion[] {
  return BASIC_ORDER_QUIZ.map((question) => ({
    ...question,
    options: [...question.options],
  }));
}

function withQuizOverrides(overrides: QuizOverride[]): QuizQuestion[] {
  return mergeQuizOverrides(BASIC_ORDER_QUIZ, overrides, QUIZ_LESSON.id) as QuizQuestion[];
}

function quizQuestionsEqual(left: QuizQuestion | undefined, right: QuizQuestion | undefined) {
  if (!left || !right) return false;
  return left.question === right.question
    && left.correctIndex === right.correctIndex
    && left.explanation === right.explanation
    && left.options.every((option, index) => option === right.options[index]);
}

function adminApiPath(path: string) {
  return `${ADMIN_API_BASE_URL}${path}`;
}

function normalizeDigits(value: string) {
  return value.replace(/[１-９]/g, (digit) =>
    String("１２３４５６７８９".indexOf(digit) + 1),
  );
}

function tilePath(suit: Suit, digit: string) {
  return `${BASE_PATH}/tiles/${SUITS[suit].prefix}${digit}-66-90-l.png`;
}

function honorTilePath() {
  return `${BASE_PATH}/tiles/ji5-66-90-l.png`;
}

function MahjongTiles({ text }: { text: string }) {
  const pattern = /([1-9１-９]+)[ \u3000]*([mpsｍｐｓ])|([発發]+)/giu;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    const isHonorRun = Boolean(match[3]);
    const digits = isHonorRun ? "" : normalizeDigits(match[1]);
    const suit = isHonorRun ? null : match[2].normalize("NFKC").toLowerCase() as Suit;
    const tiles = isHonorRun ? [...match[3]].map(() => "発") : digits.split("");
    parts.push(
      <span
        className="tile-run"
        key={`${match.index}-${match[0]}`}
        aria-label={isHonorRun ? tiles.join("") : `${digits}${suit}`}
      >
        {tiles.map((tile, index) => (
          <span className="tile-slot" key={`${tile}-${index}`}>
            {/* Approved tile PNGs keep their original 66×90 dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tile-image"
              src={isHonorRun ? honorTilePath() : tilePath(suit as Suit, tile)}
              width="66"
              height="90"
              alt={isHonorRun ? "発" : `${tile}${SUITS[suit as Suit].label}`}
              loading="eager"
              onError={(event) => {
                event.currentTarget.hidden = true;
                const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.hidden = false;
              }}
            />
            <span className="tile-fallback" hidden aria-hidden="true">
              {isHonorRun ? "発" : `${tile}${suit}`}
            </span>
          </span>
        ))}
      </span>,
    );
    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function MahjongText({ text, links = true }: { text: string; links?: boolean }) {
  return (
    <>
      {tokenizeRichText(text).map((token, index) => {
        if (token.type === "image") {
          return (
            <figure className="card-image" key={`image-${token.url}-${index}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={token.url} alt={token.alt || "カード画像"} loading="lazy" />
              {token.alt ? <figcaption>{token.alt}</figcaption> : null}
            </figure>
          );
        }
        if (token.type !== "link") return <MahjongTiles text={token.value} key={`text-${index}`} />;
        const content = (
          <>
            <span className="embedded-link__icon" aria-hidden="true">
              {token.kind === "youtube" ? "▶" : "↗"}
            </span>
            <span>{token.label}</span>
          </>
        );
        return links ? (
          <a
            className={`embedded-link embedded-link--${token.kind}`}
            href={token.url}
            target="_blank"
            rel="noreferrer"
            title={token.url}
            aria-label={`${token.label}（新しいタブ）`}
            key={`${token.url}-${index}`}
          >
            {content}
          </a>
        ) : (
          <span
            className={`embedded-link embedded-link--${token.kind} embedded-link--static`}
            title={token.url}
            key={`${token.url}-${index}`}
          >
            {content}
          </span>
        );
      })}
    </>
  );
}

function safeSave(
  reviewCardIdsByLesson: ReviewCardIdsByLesson,
  lastSession: LastSession | null,
  session: SavedFlashcardSession | null = null,
  favoriteCardIdsByLesson?: FavoriteCardIdsByLesson,
) {
  try {
    const existing = favoriteCardIdsByLesson ?? (() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
        return stored?.favoriteCardIdsByLesson && typeof stored.favoriteCardIdsByLesson === "object"
          ? stored.favoriteCardIdsByLesson as FavoriteCardIdsByLesson
          : {};
      } catch {
        return {};
      }
    })();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reviewCardIdsByLesson, favoriteCardIdsByLesson: existing, lastSession, session }),
    );
  } catch {
    // 保存不可でも、現在のセッションはそのまま続ける。
  }
}

function createSavedFlashcardSession(
  lessonId: LessonId,
  mode: SessionMode,
  cards: readonly SessionFlashcard[],
  currentIndex: number,
  revealed: boolean,
  ratings: Record<number, Rating>,
  elapsedSeconds: number,
): SavedFlashcardSession {
  return {
    lessonId,
    mode,
    cardIds: cards.map((card) => card.id),
    currentIndex,
    revealed,
    ratings: Object.fromEntries(Object.entries(ratings).map(([id, rating]) => [String(id), rating])),
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
    updatedAt: new Date().toISOString(),
  };
}

function safeSaveQuiz(reviewQuestionIds: number[], session: SavedQuizSession | null) {
  try {
    window.localStorage.setItem(
      QUIZ_STORAGE_KEY,
      JSON.stringify({ reviewQuestionIds, session }),
    );
  } catch {
    // 保存不可でも、現在のセッションはそのまま続ける。
  }
}

function createSavedQuizSession(
  questions: readonly QuizQuestion[],
  currentIndex: number,
  answers: readonly QuizAnswer[],
  elapsedSeconds: number,
): SavedQuizSession {
  return {
    questionIds: questions.map((question) => question.id),
    currentIndex,
    answers: answers.map(({ questionId, selectedIndex }) => ({ questionId, selectedIndex })),
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
    updatedAt: new Date().toISOString(),
  };
}

function HomeHeader({
  compact = false,
  iconUrl = DEFAULT_APP_ICON_URL,
  title = DEFAULT_APP_TITLE,
  onOpenSettings,
  onOpenAnnouncements,
}: {
  compact?: boolean;
  iconUrl?: string;
  title?: string;
  onOpenSettings?: () => void;
  onOpenAnnouncements?: () => void;
}) {
  return (
    <header className={compact ? "brand brand--compact" : "brand"}>
      <div className="brand__mark" aria-hidden="true">
        <img src={iconUrl} alt="" />
        向
      </div>
      <div>
        <p className="brand__eyebrow">ENSUKU BASIC LECTURE</p>
        <h1 id={compact ? undefined : "app-title"}>{title}</h1>
      </div>
      {compact ? <span className="version">ver{APP_VERSION}</span> : (
        <div className="brand__actions">
          <button type="button" className="header-icon-button" onClick={onOpenAnnouncements} title="お知らせを見る" aria-label="お知らせを見る">📣</button>
          <button type="button" className="header-icon-button" onClick={onOpenSettings} title="設定を開く" aria-label="設定を開く">⚙</button>
          <span className="version">ver{APP_VERSION}</span>
        </div>
      )}
    </header>
  );
}

function LessonTitle({ label }: { label: string }) {
  const [date, teacher, ...topicParts] = label.split("　");
  if (!date || !teacher || topicParts.length === 0) return label;
  return (
    <>
      <span>{date}　{teacher}</span>
      <wbr />
      <span className="lesson-title-topic">　{topicParts.join("　")}</span>
    </>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [cardsByLesson, setCardsByLesson] = useState<CardsByLesson>(cloneBaseCards);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [cardOrderByLesson, setCardOrderByLesson] = useState<Record<string, number[]>>({});
  const [draggedCard, setDraggedCard] = useState<{ lessonId: string; cardId: number } | null>(null);
  const [adminDrafts, setAdminDrafts] = useState<CardsByLesson>(cloneBaseCards);
  const [quizBank, setQuizBank] = useState<QuizQuestion[]>(cloneBaseQuiz);
  const [adminQuizDrafts, setAdminQuizDrafts] = useState<QuizQuestion[]>(cloneBaseQuiz);
  const [adminSection, setAdminSection] = useState<AdminSection>("tenten0718");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [adminBusyCard, setAdminBusyCard] = useState<number | null>(null);
  const [adminPendingDelete, setAdminPendingDelete] = useState("");
  const [addedLessons, setAddedLessons] = useState<AddedLesson[]>([]);
  const [deletedLessons, setDeletedLessons] = useState<AddedLesson[]>([]);
  const [lessonEditDraft, setLessonEditDraft] = useState<AddedLesson | null>(null);
  const [lessonEditResources, setLessonEditResources] = useState<Array<Omit<LessonResource, "id" | "lessonId">>>([]);
  const [draggedLessonId, setDraggedLessonId] = useState<string | null>(null);
  const [lessonResources, setLessonResources] = useState<LessonResource[]>([]);
  const [baseLessonMetadata, setBaseLessonMetadata] = useState<Partial<Record<BaseLessonId, AddedLesson>>>({});
  const [appIconUrl, setAppIconUrl] = useState(DEFAULT_APP_ICON_URL);
  const [appIconDraft, setAppIconDraft] = useState("");
  const [appTitle, setAppTitle] = useState(DEFAULT_APP_TITLE);
  const [appTitleDraft, setAppTitleDraft] = useState(DEFAULT_APP_TITLE);
  const [appTone, setAppTone] = useState<AppTone>("mint");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; label: string } | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [customLessonCards, setCustomLessonCards] = useState<Record<string, Flashcard[]>>({});
  const [newLessonResources, setNewLessonResources] = useState<Array<Omit<LessonResource, "id" | "lessonId">>>([]);
  const [newLesson, setNewLesson] = useState({ date: "", teacher: "", title: "", videoUrl: "" });
  const [deletedCardIdsByLesson, setDeletedCardIdsByLesson] = useState<DeletedCardIdsByLesson>({
    tenten0718: [],
    tenten: [],
    nejimaki: [],
  });
  const [deletedQuizIds, setDeletedQuizIds] = useState<number[]>([]);
  const [reviewCardIdsByLesson, setReviewCardIdsByLesson] = useState<ReviewCardIdsByLesson>({
    tenten0718: [],
    tenten: [],
    nejimaki: [],
  });
  const [favoriteCardIdsByLesson, setFavoriteCardIdsByLesson] = useState<FavoriteCardIdsByLesson>({
    tenten0718: [],
    tenten: [],
    nejimaki: [],
  });
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonId>("tenten0718");
  const [openHomeSection, setOpenHomeSection] = useState<HomeSectionId | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("all");
  const [sessionCards, setSessionCards] = useState<SessionFlashcard[]>([]);
  const [sessionEditField, setSessionEditField] = useState<SessionEditField>(null);
  const [sessionEditText, setSessionEditText] = useState("");
  const [listEditDraft, setListEditDraft] = useState<ListEditDraft>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [sessionRatings, setSessionRatings] = useState<Record<number, Rating>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [quizReviewIds, setQuizReviewIds] = useState<number[]>([]);
  const [savedQuizSession, setSavedQuizSession] = useState<SavedQuizSession | null>(null);
  const [savedFlashcardSession, setSavedFlashcardSession] = useState<SavedFlashcardSession | null>(null);
  const startedAtRef = useRef(0);
  const resultRef = useRef<LastSession | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (stored === "mint" || stored === "sky" || stored === "lavender" || stored === "sunset") setAppTone(stored);
    } catch {
      // 保存できない環境では標準トーンを使う。
    }
  }, []);

  const changeAppTone = (tone: AppTone) => {
    setAppTone(tone);
    try { window.localStorage.setItem(APPEARANCE_STORAGE_KEY, tone); } catch { /* その場だけ反映する。 */ }
  };

  useEffect(() => {
    document.title = appTitle;
    const shortcutIconRels = ["icon", "shortcut icon", "apple-touch-icon"];
    shortcutIconRels.forEach((rel) => {
      const link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (link) link.href = appIconUrl;
    });
    let shortcutTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!shortcutTitle) {
      shortcutTitle = document.createElement("meta");
      shortcutTitle.name = "apple-mobile-web-app-title";
      document.head.append(shortcutTitle);
    }
    shortcutTitle.content = appTitle;
  }, [appIconUrl, appTitle]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage((current) => current === message ? "" : current), 2200);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch(adminApiPath("/api/cards"), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("問題データを取得できませんでした。");
        return response.json() as Promise<{ overrides?: CardOverride[]; quizOverrides?: QuizOverride[]; lessons?: AddedLesson[]; deletedLessons?: AddedLesson[]; resources?: LessonResource[]; customCards?: Array<Flashcard & { lessonId: string }>; cardOrders?: Array<{ lessonId: string; id: number; sortOrder: number }>; settings?: { iconUrl?: string; title?: string } }>;
      })
      .then(({ overrides = [], quizOverrides = [], lessons = [], deletedLessons = [], resources = [], customCards = [], cardOrders = [], settings = {} }) => {
        const nextCards = withOverrides(overrides);
        const nextCardOrder = cardOrders.reduce<Record<string, number[]>>((grouped, item) => {
          (grouped[item.lessonId] ??= []).push(item.id);
          return grouped;
        }, {});
        const nextQuiz = withQuizOverrides(quizOverrides);
        const nextDeletedCardIds: DeletedCardIdsByLesson = {
          tenten0718: overrides.filter((item) => item.lessonId === "tenten0718" && item.deleted).map((item) => item.id),
          tenten: overrides.filter((item) => item.lessonId === "tenten" && item.deleted).map((item) => item.id),
          nejimaki: overrides.filter((item) => item.lessonId === "nejimaki" && item.deleted).map((item) => item.id),
        };
        const nextCustomCards = customCards.reduce<Record<string, Flashcard[]>>((grouped, card) => {
          (grouped[card.lessonId] ??= []).push({ id: card.id, question: card.question, answer: card.answer });
          return grouped;
        }, {});
        Object.keys(nextCustomCards).forEach((lessonId) => { nextCustomCards[lessonId] = orderCards(nextCustomCards[lessonId], nextCardOrder[lessonId]); });
        const orderedCards = Object.fromEntries(Object.entries({ ...nextCards, ...nextCustomCards }).map(([lessonId, cards]) => [lessonId, orderCards(cards, nextCardOrder[lessonId])])) as CardsByLesson;
        setCardOrderByLesson(nextCardOrder);
        setCardsByLesson(orderedCards);
        setAdminDrafts(Object.fromEntries(Object.entries(nextCards).map(([lessonId, cards]) => [lessonId, orderCards(cards, nextCardOrder[lessonId])])) as CardsByLesson);
        setDeletedCardIdsByLesson(nextDeletedCardIds);
        setQuizBank(nextQuiz);
        setAdminQuizDrafts(nextQuiz);
        setDeletedQuizIds(quizOverrides.filter((item) => item.deleted).map((item) => item.id));
        const baseMetadata = lessons.filter((lesson) => isBaseLessonId(lesson.id)) as AddedLesson[];
        setBaseLessonMetadata(Object.fromEntries(baseMetadata.map((lesson) => [lesson.id as BaseLessonId, lesson])));
        setAddedLessons(lessons.filter((lesson) => !isBaseLessonId(lesson.id)).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || right.date.localeCompare(left.date, "ja")));
        setDeletedLessons(deletedLessons);
        setLessonResources(resources);
        setAppIconUrl(settings.iconUrl || DEFAULT_APP_ICON_URL);
        setAppIconDraft(settings.iconUrl ?? "");
        setAppTitle(settings.title || DEFAULT_APP_TITLE);
        setAppTitleDraft(settings.title || DEFAULT_APP_TITLE);
        setCustomLessonCards(nextCustomCards);
        setIsContentLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setIsContentLoading(false);
        // APIに接続できない場合も、収録済みの問題で学習を続けられる。
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = readQuizProgress(window.localStorage.getItem(QUIZ_STORAGE_KEY));
        setQuizReviewIds(stored.reviewQuestionIds);
        setSavedQuizSession(stored.session as SavedQuizSession | null);
      } catch {
        // localStorageが使えない環境では初期値のまま動作する。
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
          ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const stored = readProgress(raw);
        const savedCustomReviewIds = (() => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            return Object.fromEntries(Object.entries(parsed?.reviewCardIdsByLesson ?? {})
              .filter(([lessonId, ids]) => lessonId.startsWith("lesson-") && Array.isArray(ids))
              .map(([lessonId, ids]) => [lessonId, [...new Set((ids as unknown[]).filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 10000))].sort((left, right) => left - right)]));
          } catch {
            return {};
          }
        })();
        const savedCustomFavoriteIds = (() => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            return Object.fromEntries(Object.entries(parsed?.favoriteCardIdsByLesson ?? {})
              .filter(([lessonId, ids]) => lessonId.startsWith("lesson-") && Array.isArray(ids))
              .map(([lessonId, ids]) => [lessonId, [...new Set((ids as unknown[]).filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0 && id <= 10000))].sort((left, right) => left - right)]));
          } catch {
            return {};
          }
        })();
        setReviewCardIdsByLesson({ ...stored.reviewCardIdsByLesson, ...savedCustomReviewIds });
        setFavoriteCardIdsByLesson({ ...stored.favoriteCardIdsByLesson, ...savedCustomFavoriteIds });
        setLastSession(stored.lastSession as LastSession | null);
        setSavedFlashcardSession(stored.session as SavedFlashcardSession | null);
      } catch {
        // localStorageが使えない環境では初期値のまま動作する。
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    for (const suit of Object.keys(SUITS) as Suit[]) {
      for (let digit = 1; digit <= 9; digit += 1) {
        const image = new window.Image();
        image.src = tilePath(suit, String(digit));
      }
    }
    const honorImage = new window.Image();
    honorImage.src = honorTilePath();
  }, []);

  useEffect(() => {
    if (screen !== "session" && screen !== "quiz") return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  const activeReviewCardIdsByLesson = useMemo(() => {
    const next = {} as ReviewCardIdsByLesson;
    for (const lessonId of Object.keys(cardsByLesson)) {
      const availableIds = new Set((cardsByLesson[lessonId] ?? []).map((card) => card.id));
      next[lessonId] = (reviewCardIdsByLesson[lessonId] ?? []).filter((id) => availableIds.has(id));
    }
    return next;
  }, [cardsByLesson, reviewCardIdsByLesson]);
  const activeQuizReviewIds = useMemo(() => {
    const availableIds = new Set(quizBank.map((question) => question.id));
    return quizReviewIds.filter((id) => availableIds.has(id));
  }, [quizBank, quizReviewIds]);
  const activeFavoriteCardIdsByLesson = useMemo(() => {
    const next = {} as FavoriteCardIdsByLesson;
    for (const lessonId of Object.keys(cardsByLesson)) {
      const availableIds = new Set((cardsByLesson[lessonId] ?? []).map((card) => card.id));
      next[lessonId] = (favoriteCardIdsByLesson[lessonId] ?? []).filter((id) => availableIds.has(id));
    }
    return next;
  }, [cardsByLesson, favoriteCardIdsByLesson]);
  const reviewCardIds = activeReviewCardIdsByLesson[selectedLesson] ?? [];
  const reviewSet = useMemo(() => new Set(reviewCardIds), [reviewCardIds]);
  const favoriteCardIds = activeFavoriteCardIdsByLesson[selectedLesson] ?? [];
  const favoriteSet = useMemo(() => new Set(favoriteCardIds), [favoriteCardIds]);
  const favoriteCards = useMemo(() => Object.entries(cardsByLesson).flatMap(([lessonId, cards]) => {
    const ids = new Set(activeFavoriteCardIdsByLesson[lessonId] ?? []);
    return cards.filter((card) => ids.has(card.id)).map((card) => ({ lessonId, card }));
  }), [activeFavoriteCardIdsByLesson, cardsByLesson]);
  const favoriteSessionCards = useMemo<SessionFlashcard[]>(() => favoriteCards.map(({ lessonId, card }) => ({
    ...card,
    id: favoriteSessionCardId(lessonId, card.id),
    sourceLessonId: lessonId,
    sourceCardId: card.id,
  })), [favoriteCards]);
  const currentCard = sessionCards[cardIndex];
  const currentCardLessonId = currentCard?.sourceLessonId ?? selectedLesson;
  const currentCardId = currentCard?.sourceCardId ?? currentCard?.id;
  const currentCardIsFavorite = currentCardId !== undefined
    && (activeFavoriteCardIdsByLesson[currentCardLessonId] ?? []).includes(currentCardId);
  const currentQuizQuestion = quizQuestions[quizIndex];
  const flashcardNumber = (lessonId: LessonId, cardId: number) =>
    (cardsByLesson[lessonId]?.findIndex((card) => card.id === cardId) ?? -1) + 1;
  const quizQuestionNumber = (questionId: number) =>
    quizBank.findIndex((question) => question.id === questionId) + 1;
  const currentQuizAnswer = quizAnswers.find((answer) => answer.questionId === currentQuizQuestion?.id);
  const quizSelectedIndex = currentQuizAnswer?.selectedIndex ?? null;
  const quizReviewSet = useMemo(() => new Set(activeQuizReviewIds), [activeQuizReviewIds]);
  const progress = sessionCards.length
    ? ((cardIndex + 1) / sessionCards.length) * 100
    : 0;
  const quizProgress = quizQuestions.length
    ? (quizAnswers.length / quizQuestions.length) * 100
    : 0;
  const quizResult = useMemo(
    () => scoreQuiz(quizAnswers, quizQuestions.length),
    [quizAnswers, quizQuestions.length],
  );
  const missedQuizQuestions = useMemo(() => {
    const missedIds = new Set(quizAnswers.filter((answer) => !answer.correct).map((answer) => answer.questionId));
    return quizQuestions.filter((question) => missedIds.has(question.id));
  }, [quizAnswers, quizQuestions]);

  const persistFlashcardSession = useCallback((
    nextIndex = cardIndex,
    nextRevealed = revealed,
    nextRatings = sessionRatings,
    nextElapsed = elapsedSeconds,
  ) => {
    if (!sessionCards.length) return;
    const session = createSavedFlashcardSession(
      selectedLesson,
      sessionMode,
      sessionCards,
      nextIndex,
      nextRevealed,
      nextRatings,
      nextElapsed,
    );
    setSavedFlashcardSession(session);
    safeSave(activeReviewCardIdsByLesson, lastSession, session);
  }, [activeReviewCardIdsByLesson, cardIndex, elapsedSeconds, lastSession, revealed, selectedLesson, sessionCards, sessionMode, sessionRatings]);

  const startSession = useCallback(
    (lessonId: LessonId, mode: SessionMode) => {
      if (isContentLoading) return;
      const sourceCards = cardsByLesson[lessonId] ?? [];
      const reviewIds = new Set(activeReviewCardIdsByLesson[lessonId] ?? []);
      const cards = mode === "all" ? [...sourceCards] : sourceCards.filter((card) => reviewIds.has(card.id));
      if (cards.length === 0) return;
      setSelectedLesson(lessonId);
      setSessionMode(mode);
      setSessionCards(cards);
      setSessionEditField(null);
      setSessionEditText("");
      setCardIndex(0);
      setRevealed(false);
      setKnownCount(0);
      setAgainCount(0);
      setSessionRatings({});
      setElapsedSeconds(0);
      setIsAdvancing(false);
      resultRef.current = null;
      startedAtRef.current = Date.now();
      const initialSession = createSavedFlashcardSession(lessonId, mode, cards, 0, false, {}, 0);
      setSavedFlashcardSession(initialSession);
      safeSave(activeReviewCardIdsByLesson, lastSession, initialSession);
      setScreen("session");
    },
    [activeReviewCardIdsByLesson, cardsByLesson, isContentLoading, lastSession],
  );

  const startFavoriteSession = useCallback(() => {
    if (!favoriteSessionCards.length) return;
    const cards = favoriteSessionCards.map((card) => ({ ...card }));
    setSelectedLesson(FAVORITES_SESSION_ID);
    setSessionMode("all");
    setSessionCards(cards);
    setSessionEditField(null);
    setSessionEditText("");
    setCardIndex(0);
    setRevealed(false);
    setKnownCount(0);
    setAgainCount(0);
    setSessionRatings({});
    setElapsedSeconds(0);
    setIsAdvancing(false);
    resultRef.current = null;
    startedAtRef.current = Date.now();
    const initialSession = createSavedFlashcardSession(FAVORITES_SESSION_ID, "all", cards, 0, false, {}, 0);
    setSavedFlashcardSession(initialSession);
    safeSave(activeReviewCardIdsByLesson, lastSession, initialSession);
    setScreen("session");
  }, [activeReviewCardIdsByLesson, favoriteSessionCards, lastSession]);

  const resumeSession = useCallback(() => {
    if (isContentLoading) return;
    if (!savedFlashcardSession) return;
    const sourceCards = savedFlashcardSession.lessonId === FAVORITES_SESSION_ID
      ? favoriteSessionCards
      : cardsByLesson[savedFlashcardSession.lessonId] ?? [];
    const cards = savedFlashcardSession.cardIds.flatMap((id) => {
      const card = sourceCards.find((item) => item.id === id);
      return card ? [card] : [];
    });
    if (!cards.length) return;
    const ratings = Object.fromEntries(
      Object.entries(savedFlashcardSession.ratings ?? {}).filter(([id, rating]) =>
        cards.some((card) => String(card.id) === id) && (rating === "known" || rating === "again"),
      ).map(([id, rating]) => [Number(id), rating as Rating]),
    ) as Record<number, Rating>;
    const index = Math.max(0, Math.min(savedFlashcardSession.currentIndex, cards.length - 1));
    setSelectedLesson(savedFlashcardSession.lessonId);
    setSessionMode(savedFlashcardSession.mode);
    setSessionCards(cards);
    setCardIndex(index);
    setRevealed(Boolean(savedFlashcardSession.revealed));
    setSessionRatings(ratings);
    setKnownCount(Object.values(ratings).filter((rating) => rating === "known").length);
    setAgainCount(Object.values(ratings).filter((rating) => rating === "again").length);
    setElapsedSeconds(savedFlashcardSession.elapsedSeconds);
    setSessionEditField(null);
    setSessionEditText("");
    setIsAdvancing(false);
    startedAtRef.current = Date.now() - (savedFlashcardSession.elapsedSeconds * 1000);
    setScreen("session");
  }, [cardsByLesson, favoriteSessionCards, isContentLoading, savedFlashcardSession]);

  const startQuiz = useCallback((questions?: readonly QuizQuestion[]) => {
    const source = questions ?? quizBank;
    if (!source.length) return;
    const nextQuestions = source.map((question) => ({ ...question, options: [...question.options] }));
    const nextSession = createSavedQuizSession(nextQuestions, 0, [], 0);
    setQuizQuestions(nextQuestions);
    setQuizIndex(0);
    setQuizAnswers([]);
    setElapsedSeconds(0);
    setSavedQuizSession(nextSession);
    safeSaveQuiz(activeQuizReviewIds, nextSession);
    startedAtRef.current = Date.now();
    setScreen("quiz");
  }, [activeQuizReviewIds, quizBank]);

  const resumeQuiz = useCallback(() => {
    if (!savedQuizSession) return;
    const questionMap = new Map(quizBank.map((question) => [question.id, question]));
    const resumedQuestions = savedQuizSession.questionIds.flatMap((id) => {
      const question = questionMap.get(id);
      return question ? [{ ...question, options: [...question.options] }] : [];
    });
    if (!resumedQuestions.length) return;
    const resumedIds = new Set(resumedQuestions.map((question) => question.id));
    const resumedAnswers = savedQuizSession.answers.flatMap(({ questionId, selectedIndex }) => {
      const question = questionMap.get(questionId);
      return question && resumedIds.has(questionId)
        ? [{ questionId, selectedIndex, correct: selectedIndex === question.correctIndex }]
        : [];
    });
    const nextIndex = Math.min(savedQuizSession.currentIndex, resumedQuestions.length - 1);
    setQuizQuestions(resumedQuestions);
    setQuizIndex(nextIndex);
    setQuizAnswers(resumedAnswers);
    setElapsedSeconds(savedQuizSession.elapsedSeconds);
    startedAtRef.current = Date.now() - (savedQuizSession.elapsedSeconds * 1000);
    setScreen("quiz");
  }, [quizBank, savedQuizSession]);

  const saveQuizSnapshot = useCallback((index: number, answers: QuizAnswer[]) => {
    if (!quizQuestions.length) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
    const session = createSavedQuizSession(quizQuestions, index, answers, elapsed);
    setSavedQuizSession(session);
    safeSaveQuiz(activeQuizReviewIds, session);
  }, [activeQuizReviewIds, quizQuestions]);

  const answerQuiz = useCallback((selectedIndex: number) => {
    if (!currentQuizQuestion || quizSelectedIndex !== null) return;
    if (selectedIndex < 0 || selectedIndex >= currentQuizQuestion.options.length) return;
    const nextAnswers = [...quizAnswers, {
      questionId: currentQuizQuestion.id,
      selectedIndex,
      correct: selectedIndex === currentQuizQuestion.correctIndex,
    }];
    setQuizAnswers(nextAnswers);
    saveQuizSnapshot(quizIndex, nextAnswers);
  }, [currentQuizQuestion, quizAnswers, quizIndex, quizSelectedIndex, saveQuizSnapshot]);

  const goToQuizIndex = useCallback((nextIndex: number) => {
    if (!quizQuestions.length) return;
    const boundedIndex = Math.max(0, Math.min(nextIndex, quizQuestions.length - 1));
    setQuizIndex(boundedIndex);
    saveQuizSnapshot(boundedIndex, quizAnswers);
  }, [quizAnswers, quizQuestions.length, saveQuizSnapshot]);

  const advanceQuiz = useCallback(() => {
    if (!currentQuizQuestion) return;
    if (quizIndex < quizQuestions.length - 1) {
      goToQuizIndex(quizIndex + 1);
      return;
    }
    if (quizAnswers.length >= quizQuestions.length) {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setSavedQuizSession(null);
      safeSaveQuiz(activeQuizReviewIds, null);
      setScreen("quiz-result");
      return;
    }
    const answeredIds = new Set(quizAnswers.map((answer) => answer.questionId));
    const firstUnanswered = quizQuestions.findIndex((question) => !answeredIds.has(question.id));
    if (firstUnanswered >= 0) goToQuizIndex(firstUnanswered);
  }, [activeQuizReviewIds, currentQuizQuestion, goToQuizIndex, quizAnswers, quizIndex, quizQuestions]);

  const toggleQuizReview = useCallback((questionId: number) => {
    const nextReviewIds = activeQuizReviewIds.includes(questionId)
      ? activeQuizReviewIds.filter((id) => id !== questionId)
      : [...activeQuizReviewIds, questionId].sort((left, right) => left - right);
    setQuizReviewIds(nextReviewIds);
    if (screen === "quiz" && quizQuestions.length) {
      const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      const session = createSavedQuizSession(quizQuestions, quizIndex, quizAnswers, elapsed);
      setSavedQuizSession(session);
      safeSaveQuiz(nextReviewIds, session);
    } else {
      safeSaveQuiz(nextReviewIds, savedQuizSession);
    }
  }, [activeQuizReviewIds, quizAnswers, quizIndex, quizQuestions, savedQuizSession, screen]);

  const openAdminLogin = () => {
    setAdminError("");
    setAdminNotice("");
    setAdminPendingDelete("");
    setAdminDrafts({
      tenten0718: cardsByLesson.tenten0718.map((card) => ({ ...card })),
      tenten: cardsByLesson.tenten.map((card) => ({ ...card })),
      nejimaki: cardsByLesson.nejimaki.map((card) => ({ ...card })),
    });
    setAdminQuizDrafts(quizBank.map((question) => ({ ...question, options: [...question.options] })));
    setScreen("admin");
  };

  const loginToAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "ログインできませんでした。");
      setAdminDrafts({
        tenten0718: cardsByLesson.tenten0718.map((card) => ({ ...card })),
        tenten: cardsByLesson.tenten.map((card) => ({ ...card })),
        nejimaki: cardsByLesson.nejimaki.map((card) => ({ ...card })),
      });
      setAdminQuizDrafts(quizBank.map((question) => ({ ...question, options: [...question.options] })));
      setScreen("admin");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "ログインできませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const updateAdminDraft = (lessonId: BaseLessonId, cardId: number, field: "question" | "answer", value: string) => {
    setAdminDrafts((current) => ({
      ...current,
      [lessonId]: current[lessonId].map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card,
      ),
    }));
  };

  const addAdminCard = async (lessonId: BaseLessonId) => {
    setAdminError("");
    setAdminNotice("");
    try {
      const response = await fetch(adminApiPath(`/api/admin/cards/${lessonId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "問題を追加できませんでした。");
      const added = payload.card;
      setCardsByLesson((current) => ({ ...current, [lessonId]: [...current[lessonId], added].sort((a, b) => a.id - b.id) }));
      setAdminDrafts((current) => ({ ...current, [lessonId]: [...current[lessonId], added].sort((a, b) => a.id - b.id) }));
      setAdminNotice(`Q${String(added.id).padStart(2, "0")}を追加しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "問題を追加できませんでした。");
    }
  };

  const addLessonTitle = async () => {
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath("/api/admin/lessons"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newLesson, resources: newLessonResources }),
      });
      const payload = await response.json() as { error?: string; lesson?: AddedLesson };
      if (!response.ok || !payload.lesson) throw new Error(payload.error ?? "授業タイトルを追加できませんでした。");
      setAddedLessons((current) => [...current, payload.lesson!].sort((a, b) => b.date.localeCompare(a.date, "ja")));
      setLessonResources((current) => [...current, ...newLessonResources.map((resource) => ({
        ...resource,
        id: `pending-${crypto.randomUUID()}`,
        lessonId: payload.lesson!.id,
      }))]);
      setNewLesson({ date: "", teacher: "", title: "", videoUrl: "" });
      setNewLessonResources([]);
      setAdminNotice("授業タイトルを追加しました。メニューの先頭に表示されます。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "授業タイトルを追加できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const addCustomLessonCard = async (lessonId: string) => {
    setAdminError("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lessonId}/cards`), { method: "POST" });
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "問題を追加できませんでした。");
      setCustomLessonCards((current) => ({ ...current, [lessonId]: [...(current[lessonId] ?? []), payload.card!] }));
      setCardsByLesson((current) => ({ ...current, [lessonId]: [...(current[lessonId] ?? []), payload.card!] }));
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "問題を追加できませんでした。");
    } finally { setAdminBusyCard(null); }
  };

  const saveLessonMetadata = async () => {
    if (!lessonEditDraft) return;
    setAdminError("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lessonEditDraft.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lessonEditDraft, resources: lessonEditResources }),
      });
      const payload = await response.json() as { error?: string; lesson?: AddedLesson; resources?: LessonResource[] };
      if (!response.ok || !payload.lesson) throw new Error(payload.error ?? "授業情報を保存できませんでした。");
      if (isBaseLessonId(lessonEditDraft.id)) {
        const baseLessonId = lessonEditDraft.id as BaseLessonId;
        setBaseLessonMetadata((current) => ({ ...current, [baseLessonId]: { ...BASE_LESSON_METADATA[baseLessonId], ...payload.lesson! } }));
      } else {
        setAddedLessons((current) => current.map((lesson) => lesson.id === lessonEditDraft.id ? { ...lesson, ...payload.lesson } : lesson));
      }
      if (payload.resources) {
        setLessonResources((current) => [...current.filter((resource) => resource.lessonId !== lessonEditDraft.id), ...payload.resources!]);
      }
      setLessonEditDraft(null);
      setLessonEditResources([]);
      setAdminNotice("授業情報を保存しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "授業情報を保存できませんでした。");
    } finally { setAdminBusyCard(null); }
  };

  const deleteLessonMetadata = async (lesson: AddedLesson) => {
    if (!window.confirm(`「${lesson.title}」を削除しますか？削除後も復元できます。`)) return;
    setAdminError("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lesson.id}`), { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "授業を削除できませんでした。");
      setAddedLessons((current) => current.filter((item) => item.id !== lesson.id));
      setDeletedLessons((current) => [...current.filter((item) => item.id !== lesson.id), { ...lesson, deleted: true }]);
      setLessonEditDraft(null);
      setAdminNotice("授業を削除しました。カードと学習記録は保持されています。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "授業を削除できませんでした。");
    } finally { setAdminBusyCard(null); }
  };

  const restoreLessonMetadata = async (lesson: AddedLesson) => {
    setAdminError("");
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lesson.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lesson),
      });
      const payload = await response.json() as { error?: string; lesson?: AddedLesson };
      if (!response.ok || !payload.lesson) throw new Error(payload.error ?? "授業を復元できませんでした。");
      setDeletedLessons((current) => current.filter((item) => item.id !== lesson.id));
      setAddedLessons((current) => [...current, payload.lesson!].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || right.date.localeCompare(left.date, "ja")));
      setAdminNotice("授業を復元しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "授業を復元できませんでした。");
    } finally { setAdminBusyCard(null); }
  };

  const reorderLessons = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const original = [...addedLessons];
    const fromIndex = original.findIndex((lesson) => lesson.id === fromId);
    const toIndex = original.findIndex((lesson) => lesson.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...original];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setAddedLessons(next);
    try {
      const response = await fetch(adminApiPath("/api/admin/lessons/order"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds: next.map((lesson) => lesson.id) }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "授業の並び順を保存できませんでした。");
      setAdminNotice("授業の順番を保存しました。");
    } catch (error) {
      setAddedLessons(original);
      setAdminError(error instanceof Error ? error.message : "授業の並び順を保存できませんでした。");
    }
  };

  const saveCustomLessonCard = async (lessonId: string, card: Flashcard) => {
    setAdminError("");
    setAdminBusyCard(card.id);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lessonId}/cards/${card.id}`), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "保存できませんでした。");
      setCustomLessonCards((current) => ({ ...current, [lessonId]: (current[lessonId] ?? []).map((item) => item.id === card.id ? payload.card! : item) }));
      setCardsByLesson((current) => ({ ...current, [lessonId]: (current[lessonId] ?? []).map((item) => item.id === card.id ? payload.card! : item) }));
      setAdminNotice("問題を保存しました。");
    } catch (error) { setAdminError(error instanceof Error ? error.message : "保存できませんでした。"); }
    finally { setAdminBusyCard(null); }
  };

  const deleteCustomLessonCard = async (lessonId: string, cardId: number) => {
    setAdminError("");
    setAdminBusyCard(cardId);
    try {
      const response = await fetch(adminApiPath(`/api/admin/lessons/${lessonId}/cards/${cardId}`), { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "削除できませんでした。");
      setCustomLessonCards((current) => ({ ...current, [lessonId]: (current[lessonId] ?? []).filter((item) => item.id !== cardId) }));
      setCardsByLesson((current) => ({ ...current, [lessonId]: (current[lessonId] ?? []).filter((item) => item.id !== cardId) }));
      const nextReviewState = { ...activeReviewCardIdsByLesson, [lessonId]: (activeReviewCardIdsByLesson[lessonId] ?? []).filter((id) => id !== cardId) };
      const nextFavoriteState = { ...activeFavoriteCardIdsByLesson, [lessonId]: (activeFavoriteCardIdsByLesson[lessonId] ?? []).filter((id) => id !== cardId) };
      setReviewCardIdsByLesson(nextReviewState);
      setFavoriteCardIdsByLesson(nextFavoriteState);
      safeSave(nextReviewState, lastSession, null, nextFavoriteState);
      setAdminNotice("問題を削除しました。");
    } catch (error) { setAdminError(error instanceof Error ? error.message : "削除できませんでした。"); }
    finally { setAdminBusyCard(null); }
  };

  const uploadCardImage = async (lessonId: BaseLessonId, cardId: number, field: "question" | "answer", file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    setAdminError("");
    try {
      const response = await fetch(adminApiPath("/api/images"), {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      setAdminDrafts((current) => ({
        ...current,
        [lessonId]: current[lessonId].map((card) => card.id === cardId
          ? { ...card, [field]: `${card[field]}${card[field] ? "\\n" : ""}![画像](${payload.url})` }
          : card),
      }));
      setAdminNotice("画像を追加しました。保存すると公開されます。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    }
  };

  const uploadLessonImage = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath("/api/images"), { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      setNewLessonResources((current) => [...current, { kind: "image", label: file.name, url: payload.url! }]);
      setAdminNotice("授業資料の画像を追加しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const uploadLessonEditImage = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    setAdminBusyCard(0);
    try {
      const response = await fetch(adminApiPath("/api/images"), { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      setLessonEditResources((current) => [...current, { kind: "image", label: file.name, url: payload.url! }]);
      setAdminNotice("授業資料の画像を追加しました。授業情報を保存すると公開されます。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const saveAppIconUrl = async (
    nextIconUrl = appIconDraft,
    nextTitle = appTitleDraft,
  ) => {
    const iconUrl = nextIconUrl.trim();
    const title = nextTitle.trim();
    if (iconUrl && !/^https?:\/\//i.test(iconUrl)) {
      setAdminError("アイコンURLは https:// または http:// で入力してください。");
      return;
    }
    if (!title || title.length > 40) {
      setAdminError("ショートカット名は1〜40文字で入力してください。");
      return;
    }
    setAdminBusyCard(0);
    setAdminError("");
    try {
      const response = await fetch(adminApiPath("/api/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iconUrl, title }),
      });
      const payload = await response.json() as { error?: string; settings?: { iconUrl?: string; title?: string } };
      if (!response.ok || !payload.settings) throw new Error(payload.error ?? "アプリ設定を保存できませんでした。");
      setAppIconUrl(payload.settings.iconUrl || DEFAULT_APP_ICON_URL);
      setAppIconDraft(payload.settings.iconUrl ?? "");
      setAppTitle(payload.settings.title || DEFAULT_APP_TITLE);
      setAppTitleDraft(payload.settings.title || DEFAULT_APP_TITLE);
      setAdminNotice("ショートカット名とアプリアイコンを保存しました。iPhoneの既存ショートカットは削除して再追加してください。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "アプリ設定を保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const uploadAppIcon = async (file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    setAdminBusyCard(0);
    setAdminError("");
    try {
      const response = await fetch(adminApiPath("/api/images"), { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      await saveAppIconUrl(payload.url);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
      setAdminBusyCard(null);
    }
  };

  const updateAdminQuizDraft = (
    questionId: number,
    field: "question" | "explanation",
    value: string,
  ) => {
    setAdminQuizDrafts((current) => current.map((question) =>
      question.id === questionId ? { ...question, [field]: value } : question,
    ));
  };

  const updateAdminQuizOption = (questionId: number, optionIndex: number, value: string) => {
    setAdminQuizDrafts((current) => current.map((question) => {
      if (question.id !== questionId) return question;
      const options = [...question.options];
      options[optionIndex] = value;
      return { ...question, options };
    }));
  };

  const updateAdminQuizCorrectIndex = (questionId: number, correctIndex: number) => {
    setAdminQuizDrafts((current) => current.map((question) =>
      question.id === questionId ? { ...question, correctIndex } : question,
    ));
  };

  const uploadQuizImage = async (questionId: number, field: "question" | "explanation", file: File) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    setAdminBusyCard(questionId);
    setAdminError("");
    try {
      const response = await fetch(adminApiPath("/api/images"), { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      setAdminQuizDrafts((current) => current.map((question) => question.id === questionId
        ? { ...question, [field]: `${question[field]}${question[field] ? "\n" : ""}![画像](${payload.url})` }
        : question));
      setAdminNotice("クイズ画像を追加しました。保存すると公開されます。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally { setAdminBusyCard(null); }
  };

  const saveAdminCard = async (lessonId: BaseLessonId, card: Flashcard) => {
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(card.id);
    try {
      const response = await fetch(adminApiPath(`/api/admin/cards/${lessonId}/${card.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({ question: card.question, answer: card.answer }),
      });
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "保存できませんでした。");
      const savedCard = payload.card;
      setCardsByLesson((current) => ({
        ...current,
        [lessonId]: current[lessonId].map((item) => item.id === card.id ? savedCard : item),
      }));
      setAdminDrafts((current) => ({
        ...current,
        [lessonId]: current[lessonId].map((item) => item.id === card.id ? savedCard : item),
      }));
      const displayNumber = cardsByLesson[lessonId].findIndex((item) => item.id === card.id) + 1;
      setAdminNotice(`Q${String(displayNumber).padStart(2, "0")}を保存しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const restoreAdminCard = async (lessonId: BaseLessonId, cardId: number) => {
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(cardId);
    try {
      const response = await fetch(adminApiPath(`/api/admin/cards/${lessonId}/${cardId}`), {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "初期文に戻せませんでした。");
      const baseCard = LESSONS[lessonId].cards.find((card) => card.id === cardId);
      if (!baseCard) throw new Error("初期データが見つかりません。");
      const restoredCard = { ...baseCard };
      setCardsByLesson((current) => ({
        ...current,
        [lessonId]: current[lessonId].some((item) => item.id === cardId)
          ? current[lessonId].map((item) => item.id === cardId ? restoredCard : item)
          : [...current[lessonId], restoredCard].sort((left, right) => left.id - right.id),
      }));
      setAdminDrafts((current) => ({
        ...current,
        [lessonId]: current[lessonId].some((item) => item.id === cardId)
          ? current[lessonId].map((item) => item.id === cardId ? restoredCard : item)
          : [...current[lessonId], restoredCard].sort((left, right) => left.id - right.id),
      }));
      setDeletedCardIdsByLesson((current) => ({
        ...current,
        [lessonId]: current[lessonId].filter((id) => id !== cardId),
      }));
      setAdminNotice("問題を初期文に戻し、問題番号を詰め直しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "初期文に戻せませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const deleteAdminCard = async (lessonId: BaseLessonId, card: Flashcard, displayNumber: number) => {
    const deleteKey = `card-${lessonId}-${card.id}`;
    if (adminPendingDelete !== deleteKey) {
      setAdminPendingDelete(deleteKey);
      setAdminError("");
      setAdminNotice(`Q${String(displayNumber).padStart(2, "0")}を削除する場合は、もう一度「削除を確定」を押してください。`);
      return;
    }
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(card.id);
    try {
      const response = await fetch(adminApiPath(`/api/admin/cards/${lessonId}/${card.id}/delete`), {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "問題を削除できませんでした。");
      setCardsByLesson((current) => ({
        ...current,
        [lessonId]: current[lessonId].filter((item) => item.id !== card.id),
      }));
      setAdminDrafts((current) => ({
        ...current,
        [lessonId]: current[lessonId].filter((item) => item.id !== card.id),
      }));
      setDeletedCardIdsByLesson((current) => ({
        ...current,
        [lessonId]: [...new Set([...current[lessonId], card.id])].sort((left, right) => left - right),
      }));
      const nextReviewIds = activeReviewCardIdsByLesson[lessonId].filter((id) => id !== card.id);
      const nextReviewState = { ...activeReviewCardIdsByLesson, [lessonId]: nextReviewIds };
      const nextFavoriteIds = (activeFavoriteCardIdsByLesson[lessonId] ?? []).filter((id) => id !== card.id);
      const nextFavoriteState = { ...activeFavoriteCardIdsByLesson, [lessonId]: nextFavoriteIds };
      setReviewCardIdsByLesson(nextReviewState);
      setFavoriteCardIdsByLesson(nextFavoriteState);
      safeSave(nextReviewState, lastSession, null, nextFavoriteState);
      setAdminPendingDelete("");
      setAdminNotice("問題を削除しました。問題数と問題番号は自動で詰め直されました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "問題を削除できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const saveAdminQuizQuestion = async (question: QuizQuestion) => {
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(question.id);
    try {
      const response = await fetch(adminApiPath(`/api/admin/quizzes/${QUIZ_LESSON.id}/${question.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": adminPassword,
        },
        body: JSON.stringify({
          question: question.question,
          options: question.options,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
        }),
      });
      const payload = await response.json() as {
        error?: string;
        question?: Omit<QuizQuestion, "chapter">;
      };
      if (!response.ok || !payload.question) throw new Error(payload.error ?? "保存できませんでした。");
      const savedQuestion: QuizQuestion = {
        ...question,
        ...payload.question,
        options: [...payload.question.options],
      };
      setQuizBank((current) => current.map((item) => item.id === question.id ? savedQuestion : item));
      setAdminQuizDrafts((current) => current.map((item) => item.id === question.id ? savedQuestion : item));
      const displayNumber = quizBank.findIndex((item) => item.id === question.id) + 1;
      setAdminNotice(`4択クイズ Q${String(displayNumber).padStart(2, "0")}を保存しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const restoreAdminQuizQuestion = async (questionId: number) => {
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(questionId);
    try {
      const response = await fetch(adminApiPath(`/api/admin/quizzes/${QUIZ_LESSON.id}/${questionId}`), {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "初期文に戻せませんでした。");
      const baseQuestion = BASIC_ORDER_QUIZ.find((question) => question.id === questionId);
      if (!baseQuestion) throw new Error("初期データが見つかりません。");
      const restoredQuestion: QuizQuestion = { ...baseQuestion, options: [...baseQuestion.options] };
      setQuizBank((current) => current.some((item) => item.id === questionId)
        ? current.map((item) => item.id === questionId ? restoredQuestion : item)
        : [...current, restoredQuestion].sort((left, right) => left.id - right.id));
      setAdminQuizDrafts((current) => current.some((item) => item.id === questionId)
        ? current.map((item) => item.id === questionId ? restoredQuestion : item)
        : [...current, restoredQuestion].sort((left, right) => left.id - right.id));
      setDeletedQuizIds((current) => current.filter((id) => id !== questionId));
      setAdminNotice("4択クイズを初期文に戻し、問題番号を詰め直しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "初期文に戻せませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const deleteAdminQuizQuestion = async (question: QuizQuestion, displayNumber: number) => {
    const deleteKey = `quiz-${question.id}`;
    if (adminPendingDelete !== deleteKey) {
      setAdminPendingDelete(deleteKey);
      setAdminError("");
      setAdminNotice(`4択クイズ Q${String(displayNumber).padStart(2, "0")}を削除する場合は、もう一度「削除を確定」を押してください。`);
      return;
    }
    setAdminError("");
    setAdminNotice("");
    setAdminBusyCard(question.id);
    try {
      const response = await fetch(adminApiPath(`/api/admin/quizzes/${QUIZ_LESSON.id}/${question.id}/delete`), {
        method: "DELETE",
        headers: { "X-Admin-Password": adminPassword },
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "4択クイズを削除できませんでした。");
      setQuizBank((current) => current.filter((item) => item.id !== question.id));
      setAdminQuizDrafts((current) => current.filter((item) => item.id !== question.id));
      setDeletedQuizIds((current) => [...new Set([...current, question.id])].sort((left, right) => left - right));
      const nextReviewIds = activeQuizReviewIds.filter((id) => id !== question.id);
      setQuizReviewIds(nextReviewIds);
      setSavedQuizSession(null);
      safeSaveQuiz(nextReviewIds, null);
      setAdminPendingDelete("");
      setAdminNotice("4択クイズを削除しました。問題数と問題番号は自動で詰め直されました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "4択クイズを削除できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const leaveAdmin = () => {
    setAdminPassword("");
    setAdminError("");
    setAdminNotice("");
    setAdminPendingDelete("");
    setScreen("home");
  };

  const rateCard = useCallback(
    (rating: Rating) => {
      if (!revealed || isAdvancing || !currentCard) return;
      setIsAdvancing(true);

      const sourceLessonId = currentCard.sourceLessonId ?? selectedLesson;
      const sourceCardId = currentCard.sourceCardId ?? currentCard.id;

      const nextReviewIds = updateReviewIds(
        activeReviewCardIdsByLesson[sourceLessonId],
        sourceCardId,
        rating,
      );
      const nextReviewCardIdsByLesson = {
        ...activeReviewCardIdsByLesson,
        [sourceLessonId]: nextReviewIds,
      };
      const nextRatings = { ...sessionRatings, [currentCard.id]: rating };
      const nextKnown = Object.values(nextRatings).filter((value) => value === "known").length;
      const nextAgain = Object.values(nextRatings).filter((value) => value === "again").length;
      const isLast = cardIndex >= sessionCards.length - 1;

      setReviewCardIdsByLesson(nextReviewCardIdsByLesson);
      setKnownCount(nextKnown);
      setAgainCount(nextAgain);
      setSessionRatings(nextRatings);

      if (isLast) {
        const finalElapsed = Math.floor(
          (Date.now() - startedAtRef.current) / 1000,
        );
        const rate = Math.round((nextKnown / sessionCards.length) * 100);
        const result: LastSession = {
          lessonId: selectedLesson,
          mode: sessionMode,
          count: sessionCards.length,
          known: nextKnown,
          again: nextAgain,
          rate,
          rank: getRank(rate),
          elapsedSeconds: finalElapsed,
          completedAt: new Date().toISOString(),
        };
        resultRef.current = result;
        setLastSession(result);
        setSavedFlashcardSession(null);
        safeSave(nextReviewCardIdsByLesson, result, null);
      } else {
        const nextSession = createSavedFlashcardSession(
          selectedLesson,
          sessionMode,
          sessionCards,
          cardIndex + 1,
          false,
          nextRatings,
          elapsedSeconds,
        );
        setSavedFlashcardSession(nextSession);
        safeSave(nextReviewCardIdsByLesson, lastSession, nextSession);
      }

      window.setTimeout(() => {
        if (isLast) {
          setElapsedSeconds(resultRef.current?.elapsedSeconds ?? elapsedSeconds);
          setScreen("result");
        } else {
          setCardIndex((index) => index + 1);
          setRevealed(false);
        }
        setIsAdvancing(false);
      }, 180);
    },
    [
      againCount,
      cardIndex,
      currentCard,
      elapsedSeconds,
      isAdvancing,
      knownCount,
      lastSession,
      revealed,
      activeReviewCardIdsByLesson,
      selectedLesson,
      sessionCards,
      sessionCards.length,
      sessionMode,
      sessionRatings,
    ],
  );

  const moveSessionCard = useCallback((offset: number) => {
    if (!sessionCards.length || isAdvancing || sessionEditField) return;
    const nextIndex = Math.max(0, Math.min(cardIndex + offset, sessionCards.length - 1));
    if (nextIndex === cardIndex) return;
    setCardIndex(nextIndex);
    setRevealed(false);
    persistFlashcardSession(nextIndex, false);
  }, [cardIndex, isAdvancing, persistFlashcardSession, sessionCards.length, sessionEditField]);

  useEffect(() => {
    if (screen !== "session") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (sessionEditField) return;
      if (event.key === " " || event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        setRevealed((value) => !value);
      } else if (revealed && event.key === "ArrowRight") {
        event.preventDefault();
        rateCard("known");
      } else if (revealed && event.key === "ArrowLeft") {
        event.preventDefault();
        rateCard("again");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rateCard, revealed, screen, sessionEditField]);

  useEffect(() => {
    if (screen !== "quiz") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToQuizIndex(quizIndex - 1);
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        advanceQuiz();
        return;
      }
      if (quizSelectedIndex !== null) return;
      const key = event.key.toUpperCase();
      const numberIndex = /^[1-4]$/.test(key) ? Number(key) - 1 : -1;
      const letterIndex = /^[A-D]$/.test(key) ? key.charCodeAt(0) - 65 : -1;
      const selectedIndex = numberIndex >= 0 ? numberIndex : letterIndex;
      if (selectedIndex >= 0) {
        event.preventDefault();
        answerQuiz(selectedIndex);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceQuiz, answerQuiz, goToQuizIndex, quizIndex, quizSelectedIndex, screen]);

  const leaveSession = () => {
    persistFlashcardSession();
    setScreen("home");
    setSessionCards([]);
    setIsAdvancing(false);
  };

  const leaveQuiz = () => {
    if (screen === "quiz" && quizQuestions.length) saveQuizSnapshot(quizIndex, quizAnswers);
    setScreen("home");
  };

  const isBaseLessonId = (lessonId: LessonId): lessonId is BaseLessonId =>
    Object.prototype.hasOwnProperty.call(LESSONS, lessonId);

  const beginSessionEdit = (field: Exclude<SessionEditField, null>) => {
    if (!currentCard) return;
    setSessionEditField(field);
    setSessionEditText(currentCard[field]);
  };

  const cancelSessionEdit = () => {
    setSessionEditField(null);
    setSessionEditText("");
  };

  const saveSessionEdit = async () => {
    if (!currentCard || !sessionEditField || !sessionEditText.trim()) return;
    const card = { ...currentCard, [sessionEditField]: sessionEditText.trim() };
    setAdminError("");
    setAdminBusyCard(card.id);
    try {
      const isBaseLesson = isBaseLessonId(selectedLesson);
      const response = await fetch(
        adminApiPath(isBaseLesson
          ? `/api/admin/cards/${selectedLesson}/${card.id}`
          : `/api/admin/lessons/${selectedLesson}/cards/${card.id}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(isBaseLesson ? { "X-Admin-Password": adminPassword } : {}),
          },
          body: JSON.stringify({ question: card.question, answer: card.answer }),
        },
      );
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "保存できませんでした。");
      const savedCard = payload.card;
      setCardsByLesson((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      setSessionCards((current) => current.map((item) => item.id === savedCard.id ? savedCard : item));
      if (isBaseLesson) {
        setAdminDrafts((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      } else {
        setCustomLessonCards((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      }
      setAdminNotice("カードを保存しました。");
      cancelSessionEdit();
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const beginListEdit = (card: Flashcard) => {
    setListEditDraft({ ...card });
    setAdminError("");
  };

  const uploadListImage = async (field: "question" | "answer", file: File, action: "append" | "replace") => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAdminError("JPEG・PNG・WebP・GIF画像を選択してください。");
      return;
    }
    if (!listEditDraft) return;
    setAdminBusyCard(listEditDraft.id);
    setAdminError("");
    try {
      const response = await fetch(adminApiPath("/api/images"), { method: "POST", headers: { "Content-Type": file.type }, body: file });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "画像をアップロードできませんでした。");
      setListEditDraft((current) => {
        if (!current) return current;
        const imageMarkdown = `![画像](${payload.url})`;
        const currentText = current[field];
        const hasExistingImage = IMAGE_MARKDOWN_PATTERN.test(currentText);
        const nextText = action === "replace" && hasExistingImage
          ? currentText.replace(IMAGE_MARKDOWN_PATTERN, imageMarkdown)
          : `${currentText}${currentText ? "\n" : ""}${imageMarkdown}`;
        return { ...current, [field]: nextText };
      });
      setAdminNotice(action === "replace" ? "画像を差し替えました。保存すると公開されます。" : "画像を挿入しました。保存すると公開されます。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "画像をアップロードできませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const appendListImage = (field: "question" | "answer", file: File) => uploadListImage(field, file, "append");
  const replaceListImage = (field: "question" | "answer", file: File) => uploadListImage(field, file, "replace");

  const saveListEdit = async () => {
    if (!listEditDraft || !listEditDraft.question.trim() || !listEditDraft.answer.trim()) return;
    const card = { ...listEditDraft, question: listEditDraft.question.trim(), answer: listEditDraft.answer.trim() };
    setAdminBusyCard(card.id);
    setAdminError("");
    try {
      const isBaseLesson = isBaseLessonId(selectedLesson);
      const response = await fetch(adminApiPath(isBaseLesson
        ? `/api/admin/cards/${selectedLesson}/${card.id}`
        : `/api/admin/lessons/${selectedLesson}/cards/${card.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(isBaseLesson ? { "X-Admin-Password": adminPassword } : {}) },
        body: JSON.stringify({ question: card.question, answer: card.answer }),
      });
      const payload = await response.json() as { error?: string; card?: Flashcard };
      if (!response.ok || !payload.card) throw new Error(payload.error ?? "保存できませんでした。");
      const savedCard = payload.card;
      setCardsByLesson((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      if (isBaseLesson) setAdminDrafts((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      else setCustomLessonCards((current) => ({ ...current, [selectedLesson]: (current[selectedLesson] ?? []).map((item) => item.id === savedCard.id ? savedCard : item) }));
      setListEditDraft(null);
      setAdminNotice("問題を保存しました。");
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const reorderCards = async (lessonId: string, fromCardId: number, toCardId: number) => {
    if (fromCardId === toCardId) return;
    const original = cardsByLesson[lessonId] ?? [];
    const fromIndex = original.findIndex((card) => card.id === fromCardId);
    const toIndex = original.findIndex((card) => card.id === toCardId);
    if (fromIndex < 0 || toIndex < 0) return;
    const reordered = [...original];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const cardIds = reordered.map((card) => card.id);
    setCardsByLesson((current) => ({ ...current, [lessonId]: reordered }));
    setCardOrderByLesson((current) => ({ ...current, [lessonId]: cardIds }));
    if (isBaseLessonId(lessonId)) setAdminDrafts((current) => ({ ...current, [lessonId]: orderCards(current[lessonId] ?? [], cardIds) }));
    else setCustomLessonCards((current) => ({ ...current, [lessonId]: orderCards(current[lessonId] ?? [], cardIds) }));
    setAdminError("");
    try {
      const isBaseLesson = isBaseLessonId(lessonId);
      const response = await fetch(adminApiPath(isBaseLesson ? `/api/admin/cards/${lessonId}/order` : `/api/admin/lessons/${lessonId}/cards/order`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(isBaseLesson ? { "X-Admin-Password": adminPassword } : {}) },
        body: JSON.stringify({ cardIds }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "並び替えを保存できませんでした。");
      setAdminNotice("問題の順番を保存しました。");
    } catch (error) {
      setCardsByLesson((current) => ({ ...current, [lessonId]: original }));
      setCardOrderByLesson((current) => ({ ...current, [lessonId]: original.map((card) => card.id) }));
      if (isBaseLessonId(lessonId)) setAdminDrafts((current) => ({ ...current, [lessonId]: orderCards(current[lessonId] ?? [], original.map((card) => card.id)) }));
      else setCustomLessonCards((current) => ({ ...current, [lessonId]: orderCards(current[lessonId] ?? [], original.map((card) => card.id)) }));
      setAdminError(error instanceof Error ? error.message : "並び替えを保存できませんでした。");
    }
  };

  const dropCard = (lessonId: string, targetCardId: number) => {
    if (draggedCard?.lessonId === lessonId) void reorderCards(lessonId, draggedCard.cardId, targetCardId);
    setDraggedCard(null);
  };

  const toggleFavoriteCard = (lessonId: LessonId, cardId: number) => {
    const currentIds = activeFavoriteCardIdsByLesson[lessonId] ?? [];
    const isRemoving = currentIds.includes(cardId);
    const nextIds = currentIds.includes(cardId)
      ? currentIds.filter((id) => id !== cardId)
      : [...currentIds, cardId].sort((left, right) => left - right);
    const nextFavoriteState = { ...activeFavoriteCardIdsByLesson, [lessonId]: nextIds };
    setFavoriteCardIdsByLesson(nextFavoriteState);
    safeSave(activeReviewCardIdsByLesson, lastSession, savedFlashcardSession, nextFavoriteState);
    showToast(isRemoving ? "お気に入りから削除しました" : "お気に入りに追加しました");
  };

  const addCardFromList = () => {
    if (isBaseLessonId(selectedLesson)) void addAdminCard(selectedLesson);
    else void addCustomLessonCard(selectedLesson);
  };

  const deleteCardFromList = (card: Flashcard, displayNumber: number) => {
    if (isBaseLessonId(selectedLesson)) void deleteAdminCard(selectedLesson, card, displayNumber);
    else void deleteCustomLessonCard(selectedLesson, card.id);
  };

  const lessonLabel = (lessonId: LessonId) => {
    if (lessonId === FAVORITES_SESSION_ID) return "お気に入り";
    if (isBaseLessonId(lessonId)) {
      const lesson = baseLessonMetadata[lessonId] ?? BASE_LESSON_METADATA[lessonId];
      return `${lesson.date}　${lesson.teacher}　${lesson.title}`;
    }
    const lesson = addedLessons.find((item) => item.id === lessonId);
    return lesson ? `${lesson.date}　${lesson.teacher}　${lesson.title}` : "授業の復習";
  };

  const renderAddedLessonPanel = (lesson: AddedLesson) => {
    const cards = cardsByLesson[lesson.id] ?? [];
    const lessonReviewIds = activeReviewCardIdsByLesson[lesson.id] ?? [];
    const isOpen = openHomeSection === lesson.id;
    const contentId = `lesson-content-${lesson.id}`;
    return (
    <section className={`mode-panel mode-panel--collapsible ${isOpen ? "mode-panel--open" : ""}`} aria-label={`${lesson.date}　${lesson.teacher}　${lesson.title}`} key={lesson.id}>
      <div className="lesson-summary">
        <button className="lesson-summary__toggle" type="button" onClick={() => setOpenHomeSection(isOpen ? null : lesson.id)} aria-expanded={isOpen} aria-controls={contentId} data-testid={`toggle-lesson-${lesson.id}`}>
          <span className="lesson-summary__title">{lesson.date}　{lesson.teacher}　{lesson.title}</span>
          <span className="review-count">解き直し <strong>{lessonReviewIds.length}</strong>枚</span>
          <span className="lesson-summary__chevron" aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
        </button>
        {lesson.videoUrl && (
          <a className="youtube-icon-button" href={lesson.videoUrl} target="_blank" rel="noreferrer" aria-label={`${lesson.title}の授業動画をYouTubeで見る`}>
            <span className="youtube-play-mark" aria-hidden="true" />
          </a>
        )}
        {lessonResources.filter((resource) => resource.lessonId === lesson.id).map((resource) => resource.kind === "image" ? (
          <button type="button" className="lesson-resource-icon lesson-resource-icon--image" onClick={() => setImagePreview({ url: resource.url, label: resource.label || "画像資料" })} aria-label={`${resource.label || "画像資料"}を画面内で開く`} title="画像資料を画面内で開く" key={resource.id}>▧</button>
        ) : (
          <a className={`lesson-resource-icon lesson-resource-icon--${resource.kind}`} href={resource.url} target="_blank" rel="noreferrer" aria-label={`${resource.label || "資料"}を開く`} title={resource.label || "資料を開く"} key={resource.id}>↗</a>
        ))}
      </div>

      {isOpen && (
        <div className="mode-panel__content" id={contentId}>
          {cards.length > 0 ? <>
            {savedFlashcardSession?.lessonId === lesson.id && (
              <button className="resume-session-button" onClick={resumeSession} disabled={isContentLoading} data-testid={`resume-${lesson.id}`}>
                ▶ 途中から再開 <small>Q{String(savedFlashcardSession.currentIndex + 1).padStart(2, "0")}から</small>
              </button>
            )}
            <div className="mode-grid">
              <button className="mode-card mode-card--primary" onClick={() => startSession(lesson.id, "all")} disabled={isContentLoading} data-testid={`start-all-${lesson.id}`}>
                <span className="mode-card__number">{cards.length}</span><span><strong>全{cards.length}問</strong><small>講義内容を一周する</small></span><span className="mode-card__arrow" aria-hidden="true">→</span>
              </button>
              <button className="mode-card mode-card--review" onClick={() => startSession(lesson.id, "review")} disabled={isContentLoading || lessonReviewIds.length === 0} data-testid={`start-review-${lesson.id}`}>
                <span className="mode-card__number">↺</span><span><strong>解き直しカード</strong><small>{lessonReviewIds.length ? `${lessonReviewIds.length}枚を解き直す` : "解き直しに追加すると使えます"}</small></span><span className="mode-card__arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <button className="text-button lesson-list-button" onClick={() => { setSelectedLesson(lesson.id); setScreen("list"); }}><span aria-hidden="true">☷</span> 問題一覧を見る</button>
          </> : <p className="empty-state">問題を追加するとここから始められます。</p>}
        </div>
      )}
    </section>
    );
  };

  const renderLessonPanel = (lessonId: BaseLessonId) => {
    const lesson = LESSONS[lessonId];
    const metadata = baseLessonMetadata[lessonId] ?? BASE_LESSON_METADATA[lessonId];
    const label = `${metadata.date}　${metadata.teacher}　${metadata.title}`;
    const lessonReviewIds = activeReviewCardIdsByLesson[lessonId];
    const isOpen = openHomeSection === lessonId;
    const contentId = `lesson-content-${lessonId}`;
    return (
      <section className={`mode-panel mode-panel--collapsible ${isOpen ? "mode-panel--open" : ""}`} aria-label={label} key={lessonId}>
        <div className="lesson-summary">
          <button
            className="lesson-summary__toggle"
            type="button"
            onClick={() => setOpenHomeSection(isOpen ? null : lessonId)}
            aria-expanded={isOpen}
            aria-controls={contentId}
            data-testid={`toggle-lesson-${lessonId}`}
          >
            <span className="lesson-summary__title">{label}</span>
            <span className="review-count">
              解き直し <strong>{lessonReviewIds.length}</strong>枚
            </span>
            <span className="lesson-summary__chevron" aria-hidden="true">{isOpen ? "⌃" : "⌄"}</span>
          </button>
          {metadata.videoUrl && (
            <a
              className="youtube-icon-button"
              href={metadata.videoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${label}の授業動画をYouTubeで見る`}
              title="授業動画をYouTubeで見る"
            >
              <span className="youtube-play-mark" aria-hidden="true" />
            </a>
          )}
          {lessonResources.filter((resource) => resource.lessonId === lessonId).map((resource) => resource.kind === "image" ? (
            <button type="button" className="lesson-resource-icon lesson-resource-icon--image" onClick={() => setImagePreview({ url: resource.url, label: resource.label || "画像資料" })} aria-label={`${resource.label || "画像資料"}を画面内で開く`} title="画像資料を画面内で開く" key={resource.id}>▧</button>
          ) : (
            <a className={`lesson-resource-icon lesson-resource-icon--${resource.kind}`} href={resource.url} target="_blank" rel="noreferrer" aria-label={`${resource.label || "資料"}を開く`} title={resource.label || "資料を開く"} key={resource.id}>↗</a>
          ))}
        </div>

        {isOpen && (
          <div className="mode-panel__content" id={contentId}>
            {savedFlashcardSession?.lessonId === lessonId && (
              <button className="resume-session-button" onClick={resumeSession} disabled={isContentLoading} data-testid={`resume-${lessonId}`}>
                ▶ 途中から再開 <small>Q{String(savedFlashcardSession.currentIndex + 1).padStart(2, "0")}から</small>
              </button>
            )}
            <div className="mode-grid">
              <button
                className="mode-card mode-card--primary"
                onClick={() => startSession(lessonId, "all")}
                disabled={isContentLoading}
                data-testid={`start-all-${lessonId}`}
              >
                <span className="mode-card__number">{cardsByLesson[lessonId].length}</span>
                <span>
                  <strong>全{cardsByLesson[lessonId].length}問</strong>
                  <small>講義内容を一周する</small>
                </span>
                <span className="mode-card__arrow" aria-hidden="true">→</span>
              </button>
              <button
                className="mode-card mode-card--review"
                onClick={() => startSession(lessonId, "review")}
                disabled={isContentLoading || lessonReviewIds.length === 0}
                data-testid={`start-review-${lessonId}`}
              >
                <span className="mode-card__number">↺</span>
                <span>
                  <strong>解き直しカード</strong>
                  <small>
                    {lessonReviewIds.length
                      ? `${lessonReviewIds.length}枚を解き直す`
                      : "回答後に追加できます"}
                  </small>
                </span>
                <span className="mode-card__arrow" aria-hidden="true">→</span>
              </button>
            </div>
            <button
              className="text-button lesson-list-button"
              onClick={() => {
                setSelectedLesson(lessonId);
                setScreen("list");
              }}
            >
              <span aria-hidden="true">☰</span> 問題一覧を見る
            </button>
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="app-shell" data-tone={appTone}>
      <div className="felt-grain" aria-hidden="true" />
      {toastMessage && <div className="toast-message" role="status">{toastMessage}</div>}
      {imagePreview && (
        <section className="image-preview" role="dialog" aria-modal="true" aria-label={imagePreview.label} onClick={() => setImagePreview(null)}>
          <div className="image-preview__panel" onClick={(event) => event.stopPropagation()}>
            <div className="image-preview__top"><strong>{imagePreview.label}</strong><button type="button" className="icon-button" onClick={() => setImagePreview(null)} title="画像を閉じる" aria-label="画像を閉じる">×</button></div>
            <img src={imagePreview.url} alt={imagePreview.label} />
          </div>
        </section>
      )}

      {screen === "home" && (
        <section className={`screen screen--home${isContentLoading ? " screen--home-loading" : ""}`} aria-labelledby="app-title">
          <HomeHeader iconUrl={appIconUrl} title={appTitle} onOpenSettings={() => setSettingsOpen(true)} onOpenAnnouncements={() => setAnnouncementsOpen(true)} />

          {settingsOpen && (
            <section className="settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settings-title">
              <div className="settings-sheet__header">
                <div><p className="section-kicker">SETTINGS</p><h2 id="settings-title">設定</h2></div>
                <button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} title="設定を閉じる" aria-label="設定を閉じる">×</button>
              </div>
              <div className="settings-group">
                <h3>画面のトーン</h3>
                <p>この端末だけの表示設定です。</p>
                <div className="tone-options">
                  {(["mint", "sky", "lavender", "sunset"] as const).map((tone) => (
                    <button key={tone} type="button" className={`tone-option tone-option--${tone}${appTone === tone ? " tone-option--active" : ""}`} onClick={() => changeAppTone(tone)} aria-pressed={appTone === tone} title={`${({ mint: "ミント", sky: "スカイ", lavender: "ラベンダー", sunset: "サンセット" } as const)[tone]}に変更`}>
                      {{ mint: "ミント", sky: "スカイ", lavender: "ラベンダー", sunset: "サンセット" }[tone]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-group">
                <h3>ショートカット表示名</h3>
                <p>iPhoneのBraveでホーム画面へ追加するときに使う名前です。保存後は、すでにあるショートカットを削除して追加し直してください。</p>
                <input value={appTitleDraft} onChange={(event) => setAppTitleDraft(event.target.value)} maxLength={40} placeholder={DEFAULT_APP_TITLE} aria-label="ショートカット表示名" />
                <div className="settings-actions">
                  <button type="button" className="settings-save-button" onClick={() => void saveAppIconUrl()} disabled={adminBusyCard !== null}>{adminBusyCard !== null ? "保存中…" : "名前を保存"}</button>
                  <button type="button" className="text-button" onClick={() => void saveAppIconUrl(appIconDraft, DEFAULT_APP_TITLE)} disabled={adminBusyCard !== null}>標準名に戻す</button>
                </div>
              </div>
              <div className="settings-group">
                <h3>アプリアイコン</h3>
                <p>画面のアイコンを変更します。ショートカットの絵柄は、変更後に再追加すると更新されます。</p>
                <input value={appIconDraft} onChange={(event) => setAppIconDraft(event.target.value)} placeholder="画像URLを貼り付け" aria-label="アプリアイコンURL" />
                <div className="settings-actions">
                  <label className="settings-upload-button" title="画像をアップロードしてアイコンに設定"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAppIcon(file); event.currentTarget.value = ""; }} />画像を選ぶ</label>
                  <button type="button" className="settings-save-button" onClick={() => void saveAppIconUrl()} title="アイコンURLを保存">保存</button>
                  <button type="button" className="text-button" onClick={() => void saveAppIconUrl("")} title="標準アイコンへ戻す">標準に戻す</button>
                </div>
              </div>
            </section>
          )}

          {announcementsOpen && (
            <section className="settings-sheet announcement-sheet" role="dialog" aria-modal="true" aria-labelledby="announcements-title">
              <div className="settings-sheet__header">
                <div><p className="section-kicker">ANNOUNCEMENTS</p><h2 id="announcements-title">お知らせ</h2></div>
                <button type="button" className="icon-button" onClick={() => setAnnouncementsOpen(false)} title="お知らせを閉じる" aria-label="お知らせを閉じる">×</button>
              </div>
              <div className="announcement-list">
                {APP_ANNOUNCEMENTS.map((announcement) => <article key={`${announcement.date}-${announcement.title}`} className="announcement-item"><time>{announcement.date}</time><h3>{announcement.title}</h3><p>{announcement.body}</p></article>)}
              </div>
            </section>
          )}

          {isContentLoading && <p className="home-content-loading" role="status">授業カードを読み込んでいます…</p>}

          <section
            className={`favorite-launch-panel mode-panel mode-panel--collapsible ${openHomeSection === FAVORITES_SESSION_ID ? "mode-panel--open" : ""}`}
            aria-labelledby="favorite-launch-title"
          >
            <div className="lesson-summary lesson-summary--favorites">
              <button
                className="lesson-summary__toggle"
                type="button"
                onClick={() => setOpenHomeSection(openHomeSection === FAVORITES_SESSION_ID ? null : FAVORITES_SESSION_ID)}
                aria-expanded={openHomeSection === FAVORITES_SESSION_ID}
                aria-controls="favorite-launch-content"
                data-testid="toggle-favorites-section"
              >
                <span className="lesson-summary__title" id="favorite-launch-title">★ お気に入り</span>
                <span className="review-count"><strong>{favoriteCards.length}</strong>枚</span>
                <span className="lesson-summary__chevron" aria-hidden="true">{openHomeSection === FAVORITES_SESSION_ID ? "⌃" : "⌄"}</span>
              </button>
            </div>
            {openHomeSection === FAVORITES_SESSION_ID && (
              <div className="mode-panel__content favorite-launch-content" id="favorite-launch-content">
                <div className="mode-grid">
                  <button
                    className="mode-card mode-card--favorite"
                    onClick={startFavoriteSession}
                    disabled={favoriteCards.length === 0}
                    data-testid="start-favorites-session"
                  >
                    <span className="mode-card__number">★</span>
                    <span><strong>フラッシュカードで解く</strong><small>{favoriteCards.length ? `${favoriteCards.length}枚をまとめて解く` : "お気に入りを追加すると使えます"}</small></span>
                    <span className="mode-card__arrow" aria-hidden="true">→</span>
                  </button>
                  <button className="mode-card mode-card--favorite-list" onClick={() => setScreen("favorites")} data-testid="open-favorites">
                    <span className="mode-card__number">☷</span>
                    <span><strong>問題一覧を見る</strong><small>授業をまたいで確認する</small></span>
                    <span className="mode-card__arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {addedLessons.map(renderAddedLessonPanel)}

          {renderLessonPanel("tenten0718")}

          <section
            className={`quiz-launch-panel mode-panel--collapsible ${openHomeSection === "quiz" ? "mode-panel--open" : ""}`}
            aria-labelledby="quiz-launch-title"
          >
            <div className="lesson-summary lesson-summary--quiz">
              <button
                className="lesson-summary__toggle"
                type="button"
                onClick={() => setOpenHomeSection(openHomeSection === "quiz" ? null : "quiz")}
                aria-expanded={openHomeSection === "quiz"}
                aria-controls="quiz-launch-content"
                data-testid="toggle-quiz-section"
              >
                <span className="lesson-summary__title" id="quiz-launch-title">{QUIZ_LESSON.label}　{QUIZ_LESSON.title}</span>
                <span className="review-count">
                  解き直し <strong>{activeQuizReviewIds.length}</strong>問
                </span>
                <span className="lesson-summary__chevron" aria-hidden="true">{openHomeSection === "quiz" ? "⌃" : "⌄"}</span>
              </button>
              <a
                className="youtube-icon-button"
                href={QUIZ_LESSON.videoUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${QUIZ_LESSON.label}の授業動画をYouTubeで見る`}
                title="授業動画をYouTubeで見る"
              >
                <span className="youtube-play-mark" aria-hidden="true" />
              </a>
            </div>
            {openHomeSection === "quiz" && (
              <div className="quiz-launch-content" id="quiz-launch-content">
                <div className="quiz-launch-copy">
                  <div className="quiz-launch-meta">
                    <span>4択 {quizBank.length}問</span>
                    <span>解き直し {activeQuizReviewIds.length}問</span>
                    {savedQuizSession && (
                      <span>回答済み {savedQuizSession.answers.length} / {savedQuizSession.questionIds.length}</span>
                    )}
                  </div>
                </div>
                <div className="quiz-launch-actions">
                  {savedQuizSession && (
                    <button className="quiz-resume-button" onClick={resumeQuiz} data-testid="resume-basic-order-quiz">
                      <span aria-hidden="true">▶</span>
                      <span>
                        <strong>途中から再開</strong>
                        <small>Q{String(quizQuestionNumber(savedQuizSession.questionIds[savedQuizSession.currentIndex])).padStart(2, "0")}・回答済み {savedQuizSession.answers.length}問</small>
                      </span>
                      <span aria-hidden="true">→</span>
                    </button>
                  )}
                  <button className="quiz-start-button" onClick={() => startQuiz()} data-testid="start-basic-order-quiz">
                    <span className="quiz-start-button__count">{quizBank.length}</span>
                    <span>
                      <strong>{savedQuizSession ? "最初から始める" : "クイズを始める"}</strong>
                      <small>全{quizBank.length}問</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                  <div className="quiz-secondary-actions">
                    <button
                      className="quiz-review-button"
                      onClick={() => startQuiz(quizBank.filter((question) => quizReviewSet.has(question.id)))}
                      disabled={activeQuizReviewIds.length === 0}
                      data-testid="start-quiz-review"
                    >
                      ↺ 解き直し {activeQuizReviewIds.length}問
                    </button>
                    <button className="quiz-list-button" onClick={() => setScreen("quiz-list")} data-testid="open-quiz-list">
                      ☰ クイズ問題一覧
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {renderLessonPanel("tenten")}
          {renderLessonPanel("nejimaki")}

          <div className="home-footer">
            {lastSession && (
              <p className="last-result">
                前回：{lessonLabel(lastSession.lessonId ?? "tenten")}・{modeLabel(lastSession.mode, lastSession.count)}・
                <strong>{lastSession.rate}%</strong>・ランク
                <strong>{lastSession.rank}</strong>
              </p>
            )}
            <button
              className="admin-entry-button"
              onClick={openAdminLogin}
              data-testid="open-admin"
            >
              <span aria-hidden="true">⚙</span> 管理画面
            </button>
          </div>
        </section>
      )}

      {screen === "quiz" && currentQuizQuestion && (
        <section className="screen screen--quiz" aria-live="polite" aria-labelledby="quiz-question-title">
          <div className="session-top">
            <button className="quiz-menu-button" onClick={leaveQuiz} aria-label="進捗を保存してメニューへ戻る">← メニュー</button>
            <div className="session-title">
              <span>{QUIZ_LESSON.label} · 4択クイズ</span>
              <strong>{quizAnswers.length}<small> / {quizQuestions.length} 回答済み</small></strong>
            </div>
            <div className="timer" aria-label={`経過時間 ${formatDuration(elapsedSeconds)}`}>
              <span aria-hidden="true">◷</span> {formatDuration(elapsedSeconds)}
            </div>
          </div>

          <div className="progress-track" aria-label="進捗">
            <span style={{ width: `${quizProgress}%` }} />
          </div>

          <article className={`quiz-card ${quizSelectedIndex === null ? "" : "quiz-card--answered"}`}>
            <div className="quiz-card__meta">
              <span>{currentQuizQuestion.chapter}</span>
              <strong>Q{String(quizQuestionNumber(currentQuizQuestion.id)).padStart(2, "0")}</strong>
            </div>
            <h2 id="quiz-question-title"><MahjongText text={currentQuizQuestion.question} /></h2>

            <div className="quiz-options" role="group" aria-label="選択肢">
              {currentQuizQuestion.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === currentQuizQuestion.correctIndex;
                const isSelected = optionIndex === quizSelectedIndex;
                const answerClass = quizSelectedIndex === null
                  ? ""
                  : isCorrect
                    ? " quiz-option--correct"
                    : isSelected
                      ? " quiz-option--wrong"
                      : " quiz-option--dimmed";
                return (
                  <button
                    type="button"
                    className={`quiz-option${answerClass}`}
                    key={`${currentQuizQuestion.id}-${optionIndex}`}
                    onClick={() => answerQuiz(optionIndex)}
                    disabled={quizSelectedIndex !== null}
                    aria-pressed={isSelected}
                    data-testid={`quiz-option-${optionIndex}`}
                  >
                    <span className="quiz-option__label">{choiceLabel(optionIndex)}</span>
                    <span><MahjongText text={option} links={false} /></span>
                    <kbd>{optionIndex + 1}</kbd>
                  </button>
                );
              })}
            </div>

            {quizSelectedIndex !== null && (
              <div className={`quiz-feedback ${quizSelectedIndex === currentQuizQuestion.correctIndex ? "quiz-feedback--correct" : "quiz-feedback--wrong"}`}>
                <div className="quiz-feedback__title">
                  <strong>{quizSelectedIndex === currentQuizQuestion.correctIndex ? "正解！" : "もう一度確認しよう"}</strong>
                  <span>正解 {choiceLabel(currentQuizQuestion.correctIndex)}</span>
                </div>
                <p><MahjongText text={currentQuizQuestion.explanation} /></p>
                <button
                  className={`quiz-review-toggle${quizReviewSet.has(currentQuizQuestion.id) ? " quiz-review-toggle--active" : ""}`}
                  onClick={() => toggleQuizReview(currentQuizQuestion.id)}
                  data-testid="toggle-quiz-review"
                >
                  <span aria-hidden="true">↺</span>
                  {quizReviewSet.has(currentQuizQuestion.id) ? "解き直しから外す" : "解き直しに追加"}
                </button>
              </div>
            )}
          </article>

          <nav className="quiz-navigation" aria-label="クイズ問題の移動">
            <button
              className="quiz-nav-button"
              onClick={() => goToQuizIndex(quizIndex - 1)}
              disabled={quizIndex === 0}
              data-testid="quiz-previous"
            >
              <span aria-hidden="true">←</span> 前の問題
            </button>
            <span className="quiz-position">Q{String(quizQuestionNumber(currentQuizQuestion.id)).padStart(2, "0")}</span>
            <button className="quiz-nav-button quiz-nav-button--next" onClick={advanceQuiz} data-testid="quiz-next">
              {quizIndex < quizQuestions.length - 1
                ? "次の問題"
                : quizAnswers.length >= quizQuestions.length
                  ? "結果を見る"
                  : "未回答へ"}
              <span aria-hidden="true">→</span>
            </button>
          </nav>
        </section>
      )}

      {screen === "quiz-result" && (
        <section className="screen screen--result" aria-labelledby="quiz-result-title">
          <HomeHeader compact iconUrl={appIconUrl} title={appTitle} />
          <div className="result-panel quiz-result-panel">
            <p className="section-kicker">QUIZ COMPLETE</p>
            <h2 id="quiz-result-title">4択クイズ完了！</h2>
            <p className="result-subtitle">{QUIZ_LESSON.label} · {quizQuestions.length}問</p>

            <div className="result-score">
              <div
                className="score-gauge"
                style={{ "--score": `${quizResult.rate * 3.6}deg` } as React.CSSProperties}
                aria-label={`正答率 ${quizResult.rate}%`}
              >
                <div>
                  <strong>{quizResult.rate}</strong>
                  <span>%</span>
                  <small>正答率</small>
                </div>
              </div>
              <div className={`rank-badge rank-badge--${getRank(quizResult.rate).toLowerCase()}`}>
                <span>理解度ランク</span>
                <strong>{getRank(quizResult.rate)}</strong>
                <small>{quizResult.correct} / {quizQuestions.length}問正解</small>
              </div>
            </div>

            <dl className="result-stats">
              <div><dt>正解</dt><dd>{quizResult.correct}<small>問</small></dd></div>
              <div><dt>間違い</dt><dd>{quizResult.wrong}<small>問</small></dd></div>
              <div><dt>経過時間</dt><dd>{formatDuration(elapsedSeconds)}</dd></div>
            </dl>

            {missedQuizQuestions.length > 0 && (
              <div className="quiz-mistake-list">
                <h3>間違えた問題を確認</h3>
                {missedQuizQuestions.map((question) => (
                  <details key={question.id}>
                    <summary>
                      <span>Q{String(quizQuestionNumber(question.id)).padStart(2, "0")}</span>
                      <strong><MahjongText text={question.question} /></strong>
                      <i aria-hidden="true">＋</i>
                    </summary>
                    <div>
                      <p><b>正解 {choiceLabel(question.correctIndex)}</b>：<MahjongText text={question.options[question.correctIndex]} /></p>
                      <p><MahjongText text={question.explanation} /></p>
                    </div>
                  </details>
                ))}
              </div>
            )}

            <div className="result-actions">
              {missedQuizQuestions.length > 0 && (
                <button className="review-button" onClick={() => startQuiz(missedQuizQuestions)}>
                  間違えた{missedQuizQuestions.length}問だけ再挑戦
                </button>
              )}
              <button className="primary-button" onClick={() => startQuiz()}>全30問をもう一度</button>
              <button className="text-button" onClick={leaveQuiz}>ホームへ戻る</button>
            </div>
          </div>
        </section>
      )}

      {screen === "admin-login" && (
        <section className="screen screen--admin-login" aria-labelledby="admin-login-title">
          <div className="admin-login-panel">
            <button className="icon-button" onClick={() => setScreen("home")} aria-label="ホームへ戻る">
              ←
            </button>
            <p className="section-kicker">ADMINISTRATION</p>
            <h2 id="admin-login-title">管理画面</h2>
            <p>問題文・解答文を編集するには、管理パスワードを入力してください。</p>
            <form className="admin-login-form" onSubmit={loginToAdmin}>
              <label htmlFor="admin-password">管理パスワード</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                required
                autoFocus
                data-testid="admin-password"
              />
              {adminError && <p className="admin-message admin-message--error" role="alert">{adminError}</p>}
              <button className="primary-button" type="submit" disabled={adminBusyCard !== null} data-testid="admin-login">
                {adminBusyCard !== null ? "確認中…" : "管理画面へ進む"}
              </button>
            </form>
          </div>
        </section>
      )}

      {screen === "admin" && (
        <section className="screen screen--admin" aria-labelledby="admin-title">
          <div className="admin-top">
            <button className="icon-button" onClick={leaveAdmin} aria-label="管理画面を終了">
              ←
            </button>
            <div>
              <p className="section-kicker">ADMINISTRATION</p>
              <h2 id="admin-title">問題・解答の編集</h2>
            </div>
            <button className="admin-logout-button" onClick={leaveAdmin}>終了</button>
          </div>

          <p className="admin-lead">
            保存した内容は公開中の問題集へ反映されます。牌表記は「2234ｍ」「456p」のように入力してください。
          </p>

          <section className="admin-app-icon" aria-labelledby="app-icon-title">
            <div className="admin-app-icon__preview"><img src={appIconUrl} alt="現在のアプリアイコン" /></div>
            <div>
              <p className="section-kicker">APP ICON</p>
              <h3 id="app-icon-title">アプリアイコン</h3>
              <p>画像URLの入力、または画像のクリック・ドラッグ＆ドロップで変更できます。</p>
              <label>アイコン画像URL（任意）<input type="url" value={appIconDraft} placeholder="https://..." onChange={(event) => setAppIconDraft(event.target.value)} /></label>
              <div className="admin-card-actions">
                <button type="button" className="admin-save-button" onClick={() => void saveAppIconUrl()} disabled={adminBusyCard !== null}>アイコンを保存</button>
                <button type="button" className="text-button" onClick={() => void saveAppIconUrl("")} disabled={adminBusyCard !== null}>標準に戻す</button>
              </div>
            </div>
            <label className="image-upload image-upload--drop admin-app-icon__upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadAppIcon(file); }}>
              画像をアップロード
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAppIcon(file); event.currentTarget.value = ""; }} />
              <span>クリック・ドロップで差し替え</span>
            </label>
          </section>

          <section className="admin-create-lesson">
            <div>
              <p className="section-kicker">NEW LESSON</p>
              <h3>新しい授業タイトルを追加</h3>
            </div>
            <div className="admin-meta-fields">
              <label>日付<input value={newLesson.date} placeholder="例：7/25" onChange={(event) => setNewLesson({ ...newLesson, date: event.target.value })} /></label>
              <label>先生名<input value={newLesson.teacher} placeholder="例：てんてん先生" onChange={(event) => setNewLesson({ ...newLesson, teacher: event.target.value })} /></label>
              <label>授業タイトル<input value={newLesson.title} placeholder="例：何切る応用" onChange={(event) => setNewLesson({ ...newLesson, title: event.target.value })} /></label>
              <label>動画URL（任意）<input type="url" value={newLesson.videoUrl} placeholder="https://youtu.be/..." onChange={(event) => setNewLesson({ ...newLesson, videoUrl: event.target.value })} /></label>
            </div>
            <div className="lesson-resource-fields">
              <label>資料URL（任意）<input type="url" placeholder="GoogleドキュメントなどのURL" onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const url = event.currentTarget.value.trim();
                if (!url) return;
                setNewLessonResources((current) => [...current, { kind: "link", label: "資料", url }]);
                event.currentTarget.value = "";
              }} /></label>
              <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadLessonImage(file); }}>
                画像資料を追加
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLessonImage(file); event.currentTarget.value = ""; }} />
                <span>クリック・ドロップで追加</span>
              </label>
              {newLessonResources.length > 0 && <div className="lesson-resource-drafts">{newLessonResources.map((resource, index) => <span key={`${resource.url}-${index}`}>{resource.kind === "image" ? "▧ 画像" : "↗ 資料"}<button type="button" onClick={() => setNewLessonResources((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}
            </div>
            <button type="button" className="admin-save-button" onClick={addLessonTitle} disabled={adminBusyCard !== null || !newLesson.date.trim() || !newLesson.teacher.trim() || !newLesson.title.trim()}>
              ＋ 授業タイトルを追加
            </button>
          </section>

          {addedLessons.length > 0 && (
            <section className="admin-custom-lessons">
              <p className="section-kicker">ADDED LESSONS</p>
              <h3>追加した授業の問題</h3>
              {addedLessons.map((lesson) => (
                <details
                  className="admin-custom-lesson"
                  key={lesson.id}
                  draggable
                  onDragStart={() => setDraggedLessonId(lesson.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => { if (draggedLessonId) void reorderLessons(draggedLessonId, lesson.id); setDraggedLessonId(null); }}
                >
                  <summary>{lesson.date}　{lesson.teacher}　{lesson.title}<span>＋</span></summary>
                  <div>
                    {lessonEditDraft?.id === lesson.id ? (
                      <div className="admin-meta-fields">
                        <label>日付<input value={lessonEditDraft.date} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, date: event.target.value })} /></label>
                        <label>先生名<input value={lessonEditDraft.teacher} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, teacher: event.target.value })} /></label>
                        <label>授業タイトル<input value={lessonEditDraft.title} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, title: event.target.value })} /></label>
                        <label>動画URL<input type="url" value={lessonEditDraft.videoUrl} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, videoUrl: event.target.value })} /></label>
                        <div className="lesson-resource-fields lesson-resource-fields--editor">
                          <label>資料URL（任意）<input type="url" placeholder="GoogleドキュメントなどのURL" onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            event.preventDefault();
                            const url = event.currentTarget.value.trim();
                            if (!url) return;
                            setLessonEditResources((current) => [...current, { kind: "link", label: "資料", url }]);
                            event.currentTarget.value = "";
                          }} /></label>
                          <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadLessonEditImage(file); }}>
                            画像資料を追加
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLessonEditImage(file); event.currentTarget.value = ""; }} />
                            <span>クリック・ドロップで追加</span>
                          </label>
                          {lessonEditResources.length > 0 && <div className="lesson-resource-drafts">{lessonEditResources.map((resource, index) => <span key={`${resource.url}-${index}`}>{resource.kind === "image" ? "▧ 画像" : "↗ 資料"}<button type="button" onClick={() => setLessonEditResources((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button></span>)}</div>}
                        </div>
                        <div className="admin-card-actions"><button type="button" className="admin-save-button" onClick={saveLessonMetadata} disabled={adminBusyCard !== null}>授業情報を保存</button><button type="button" className="text-button" onClick={() => { setLessonEditDraft(null); setLessonEditResources([]); }}>キャンセル</button></div>
                      </div>
                    ) : (
                      <div className="admin-card-actions"><button type="button" className="text-button" onClick={() => { setLessonEditDraft({ ...lesson }); setLessonEditResources(lessonResources.filter((resource) => resource.lessonId === lesson.id).map(({ kind, label, url }) => ({ kind, label, url }))); }}>授業情報を編集</button><button type="button" className="admin-delete-button" onClick={() => void deleteLessonMetadata(lesson)} disabled={adminBusyCard !== null}>授業を削除</button></div>
                    )}
                    <button type="button" className="admin-save-button" onClick={() => addCustomLessonCard(lesson.id)} disabled={adminBusyCard !== null}>＋ 問題を追加</button>
                    {(customLessonCards[lesson.id] ?? []).map((card, cardIndex) => (
                      <div className="custom-card-edit" key={card.id} draggable onDragStart={() => setDraggedCard({ lessonId: lesson.id, cardId: card.id })} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCard(lesson.id, card.id)}>
                        <b>↕ Q{String(cardIndex + 1).padStart(2, "0")}</b>
                        <textarea value={card.question} onChange={(event) => setCustomLessonCards((current) => ({ ...current, [lesson.id]: (current[lesson.id] ?? []).map((item) => item.id === card.id ? { ...item, question: event.target.value } : item) }))} aria-label={`Q${card.id} 問題文`} />
                        <textarea value={card.answer} onChange={(event) => setCustomLessonCards((current) => ({ ...current, [lesson.id]: (current[lesson.id] ?? []).map((item) => item.id === card.id ? { ...item, answer: event.target.value } : item) }))} aria-label={`Q${card.id} 解答文`} />
                        <div><button type="button" className="admin-save-button" onClick={() => saveCustomLessonCard(lesson.id, card)} disabled={adminBusyCard !== null}>保存</button><button type="button" className="admin-delete-button" onClick={() => deleteCustomLessonCard(lesson.id, card.id)} disabled={adminBusyCard !== null}>削除</button></div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          )}
          {deletedLessons.length > 0 && (
            <section className="admin-deleted-list">
              <h3>削除済みの授業</h3>
              <p>削除した授業は、カードと学習記録を保ったまま復元できます。</p>
              {deletedLessons.map((lesson) => (
                <div className="admin-deleted-row" key={`deleted-lesson-${lesson.id}`}>
                  <span>{lesson.date}　{lesson.teacher}　{lesson.title}</span>
                  <button type="button" onClick={() => void restoreLessonMetadata(lesson)} disabled={adminBusyCard !== null}>授業を復元</button>
                </div>
              ))}
            </section>
          )}

          <div className="admin-lesson-tabs" role="tablist" aria-label="問題集を選択">
            {ADMIN_SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={adminSection === section.id}
                className={adminSection === section.id ? "is-active" : ""}
                onClick={() => {
                  setAdminSection(section.id);
                  setAdminError("");
                  setAdminNotice("");
                  setAdminPendingDelete("");
                }}
              >
                {section.label}
              </button>
            ))}
          </div>

          {(adminError || adminNotice) && (
            <p className={`admin-message ${adminError ? "admin-message--error" : "admin-message--success"}`} role="status">
              {adminError || adminNotice}
            </p>
          )}

          {adminSection !== "quiz" && (() => {
            const metadata = baseLessonMetadata[adminSection] ?? BASE_LESSON_METADATA[adminSection];
            const editing = lessonEditDraft?.id === adminSection;
            return <details className="admin-card-editor admin-lesson-metadata" open={editing}>
              <summary><span>授業情報</span><strong>{metadata.date}　{metadata.teacher}　{metadata.title}</strong><i aria-hidden="true">＋</i></summary>
              <div className="admin-card-form">
                {editing ? <>
                  <label>日付<input value={lessonEditDraft.date} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, date: event.target.value })} /></label>
                  <label>先生名<input value={lessonEditDraft.teacher} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, teacher: event.target.value })} /></label>
                  <label>授業タイトル<input value={lessonEditDraft.title} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, title: event.target.value })} /></label>
                  <label>動画URL<input type="url" value={lessonEditDraft.videoUrl} onChange={(event) => setLessonEditDraft({ ...lessonEditDraft, videoUrl: event.target.value })} /></label>
                  <label>資料URL（Enterで追加）<input type="url" placeholder="Googleドキュメント・画像などのURL" onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); const url = event.currentTarget.value.trim(); if (!url) return; setLessonEditResources((current) => [...current, { kind: /\.(png|jpe?g|webp|gif)(?:\?|$)/i.test(url) ? "image" : "link", label: "", url }]); event.currentTarget.value = ""; }} /></label>
                  <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadLessonEditImage(file); }}>
                    資料画像を追加<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLessonEditImage(file); event.currentTarget.value = ""; }} /><span>クリック・ドラッグ＆ドロップで追加</span>
                  </label>
                  {lessonEditResources.length > 0 && <div className="lesson-resource-drafts">{lessonEditResources.map((resource, index) => <span key={`${resource.url}-${index}`}>{resource.kind === "image" ? "▧ 画像" : "↗ 資料"}<button type="button" onClick={() => setLessonEditResources((current) => current.filter((_, itemIndex) => itemIndex !== index))} title="この資料を削除">×</button></span>)}</div>}
                  <div className="admin-card-actions"><button type="button" className="admin-save-button" onClick={saveLessonMetadata} disabled={adminBusyCard !== null}>授業情報を保存</button><button type="button" className="text-button" onClick={() => { setLessonEditDraft(null); setLessonEditResources([]); }}>キャンセル</button></div>
                </> : <button type="button" className="text-button" onClick={() => { setLessonEditDraft({ ...metadata }); setLessonEditResources(lessonResources.filter((resource) => resource.lessonId === adminSection).map(({ kind, label, url }) => ({ kind, label, url }))); }}>講師名・動画・資料を編集</button>}
              </div>
            </details>;
          })()}

          {adminSection === "quiz" ? (
            <div className="admin-card-list" data-testid="admin-quiz-list">
              {adminQuizDrafts.map((question, questionIndex) => {
                const publishedQuestion = quizBank.find((item) => item.id === question.id);
                const baseQuestion = BASIC_ORDER_QUIZ.find((item) => item.id === question.id);
                const isChanged = !quizQuestionsEqual(question, publishedQuestion);
                const hasOverride = !quizQuestionsEqual(publishedQuestion, baseQuestion);
                const isComplete = question.question.trim()
                  && question.explanation.trim()
                  && question.options.every((option) => option.trim());
                return (
                  <details className="admin-card-editor" key={`quiz-${question.id}`}>
                    <summary>
                      <span>Q{String(questionIndex + 1).padStart(2, "0")}</span>
                      <strong>{question.question || "（問題文未入力）"}</strong>
                      {hasOverride && <small>編集済み</small>}
                      <i aria-hidden="true">＋</i>
                    </summary>
                    <div className="admin-card-form admin-quiz-form">
                      <p className="admin-quiz-chapter">{question.chapter}</p>
                      <label htmlFor={`quiz-question-${question.id}`}>問題文</label>
                      <textarea
                        id={`quiz-question-${question.id}`}
                        value={question.question}
                        onChange={(event) => updateAdminQuizDraft(question.id, "question", event.target.value)}
                        rows={4}
                      />
                      <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadQuizImage(question.id, "question", file); }}>
                        問題に画像を追加（ドロップ・貼り付け可）
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadQuizImage(question.id, "question", file); event.currentTarget.value = ""; }} />
                      </label>
                      <fieldset className="admin-option-fields">
                        <legend>選択肢</legend>
                        {question.options.map((option, optionIndex) => (
                          <label key={`${question.id}-option-${optionIndex}`}>
                            <span>{choiceLabel(optionIndex)}</span>
                            <textarea
                              value={option}
                              onChange={(event) => updateAdminQuizOption(question.id, optionIndex, event.target.value)}
                              rows={2}
                              aria-label={`選択肢${choiceLabel(optionIndex)}`}
                            />
                          </label>
                        ))}
                      </fieldset>
                      <fieldset className="admin-correct-options">
                        <legend>正解</legend>
                        {question.options.map((_, optionIndex) => (
                          <label key={`${question.id}-correct-${optionIndex}`}>
                            <input
                              type="radio"
                              name={`correct-${question.id}`}
                              value={optionIndex}
                              checked={question.correctIndex === optionIndex}
                              onChange={() => updateAdminQuizCorrectIndex(question.id, optionIndex)}
                            />
                            <span>{choiceLabel(optionIndex)}</span>
                          </label>
                        ))}
                      </fieldset>
                      <label htmlFor={`quiz-explanation-${question.id}`}>解説（答え）</label>
                      <textarea
                        id={`quiz-explanation-${question.id}`}
                        value={question.explanation}
                        onChange={(event) => updateAdminQuizDraft(question.id, "explanation", event.target.value)}
                        rows={5}
                      />
                      <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) void uploadQuizImage(question.id, "explanation", file); }}>
                        解説に画像を追加（ドロップ・貼り付け可）
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadQuizImage(question.id, "explanation", file); event.currentTarget.value = ""; }} />
                      </label>
                      <div className="admin-card-actions">
                        <button
                          type="button"
                          className="admin-restore-button"
                          onClick={() => restoreAdminQuizQuestion(question.id)}
                          disabled={adminBusyCard !== null || !hasOverride}
                        >
                          初期文に戻す
                        </button>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={() => deleteAdminQuizQuestion(question, questionIndex + 1)}
                          disabled={adminBusyCard !== null}
                        >
                          {adminPendingDelete === `quiz-${question.id}` ? "削除を確定" : "問題を削除"}
                        </button>
                        <button
                          type="button"
                          className="admin-save-button"
                          onClick={() => saveAdminQuizQuestion(question)}
                          disabled={adminBusyCard !== null || !isChanged || !isComplete}
                          data-testid={`save-quiz-${question.id}`}
                        >
                          {adminBusyCard === question.id ? "保存中…" : "この問題を保存"}
                        </button>
                      </div>
                    </div>
                  </details>
                );
              })}
              {deletedQuizIds.length > 0 && (
                <div className="admin-deleted-list">
                  <h3>削除済みの問題</h3>
                  <p>必要な問題は初期文の状態で戻せます。</p>
                  {deletedQuizIds.map((questionId) => {
                    const baseQuestion = BASIC_ORDER_QUIZ.find((item) => item.id === questionId);
                    if (!baseQuestion) return null;
                    return (
                      <div className="admin-deleted-row" key={`deleted-quiz-${questionId}`}>
                        <span>{baseQuestion.question}</span>
                        <button type="button" onClick={() => restoreAdminQuizQuestion(questionId)} disabled={adminBusyCard !== null}>
                          問題を戻す
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="admin-card-list">
              <div className="admin-list-toolbar">
                <button type="button" className="admin-save-button" onClick={() => addAdminCard(adminSection)} disabled={adminBusyCard !== null}>＋ 問題を追加</button>
              </div>
              {adminDrafts[adminSection].map((card, cardIndex) => {
                const publishedCard = cardsByLesson[adminSection].find((item) => item.id === card.id);
                const baseCard = LESSONS[adminSection].cards.find((item) => item.id === card.id);
                const isChanged = card.question !== publishedCard?.question
                  || card.answer !== publishedCard?.answer;
                const hasOverride = publishedCard?.question !== baseCard?.question
                  || publishedCard?.answer !== baseCard?.answer;
                return (
                  <details className="admin-card-editor" key={`${adminSection}-${card.id}`} draggable onDragStart={() => setDraggedCard({ lessonId: adminSection, cardId: card.id })} onDragOver={(event) => event.preventDefault()} onDrop={() => dropCard(adminSection, card.id)}>
                    <summary>
                      <span>↕ Q{String(cardIndex + 1).padStart(2, "0")}</span>
                      <strong>{card.question || "（問題文未入力）"}</strong>
                      {hasOverride && <small>編集済み</small>}
                      <i aria-hidden="true">＋</i>
                    </summary>
                    <div className="admin-card-form">
                      <label htmlFor={`question-${adminSection}-${card.id}`}>問題文</label>
                      <textarea
                        id={`question-${adminSection}-${card.id}`}
                        value={card.question}
                        onChange={(event) => updateAdminDraft(adminSection, card.id, "question", event.target.value)}
                        rows={4}
                      />
                      <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files?.[0];
                        if (file) void uploadCardImage(adminSection, card.id, "question", file);
                      }}>
                        問題文に画像を追加
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadCardImage(adminSection, card.id, "question", file);
                          event.currentTarget.value = "";
                        }} />
                        <span>クリックして画像を選択</span>
                      </label>
                      <label htmlFor={`answer-${adminSection}-${card.id}`}>解答文</label>
                      <textarea
                        id={`answer-${adminSection}-${card.id}`}
                        value={card.answer}
                        onChange={(event) => updateAdminDraft(adminSection, card.id, "answer", event.target.value)}
                        rows={6}
                      />
                      <label className="image-upload image-upload--drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                        event.preventDefault();
                        const file = event.dataTransfer.files?.[0];
                        if (file) void uploadCardImage(adminSection, card.id, "answer", file);
                      }}>
                        解答文に画像を追加
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void uploadCardImage(adminSection, card.id, "answer", file);
                          event.currentTarget.value = "";
                        }} />
                        <span>クリックして画像を選択</span>
                      </label>
                      <div className="admin-card-actions">
                        <button
                          type="button"
                          className="admin-restore-button"
                          onClick={() => restoreAdminCard(adminSection, card.id)}
                          disabled={adminBusyCard !== null || !hasOverride}
                        >
                          初期文に戻す
                        </button>
                        <button
                          type="button"
                          className="admin-delete-button"
                          onClick={() => deleteAdminCard(adminSection, card, cardIndex + 1)}
                          disabled={adminBusyCard !== null}
                        >
                          {adminPendingDelete === `card-${adminSection}-${card.id}` ? "削除を確定" : "問題を削除"}
                        </button>
                        <button
                          type="button"
                          className="admin-save-button"
                          onClick={() => saveAdminCard(adminSection, card)}
                          disabled={adminBusyCard !== null || !isChanged || !card.question.trim() || !card.answer.trim()}
                          data-testid={`save-${adminSection}-${card.id}`}
                        >
                          {adminBusyCard === card.id ? "保存中…" : "この問題を保存"}
                        </button>
                      </div>
                    </div>
                  </details>
                );
              })}
              {deletedCardIdsByLesson[adminSection].length > 0 && (
                <div className="admin-deleted-list">
                  <h3>削除済みの問題</h3>
                  <p>必要な問題は初期文の状態で戻せます。</p>
                  {deletedCardIdsByLesson[adminSection].map((cardId) => {
                    const baseCard = LESSONS[adminSection].cards.find((item) => item.id === cardId);
                    if (!baseCard) return null;
                    return (
                      <div className="admin-deleted-row" key={`deleted-${adminSection}-${cardId}`}>
                        <span>{baseCard.question}</span>
                        <button type="button" onClick={() => restoreAdminCard(adminSection, cardId)} disabled={adminBusyCard !== null}>
                          問題を戻す
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {screen === "session" && currentCard && (
        <section className="screen screen--session" aria-live="polite">
          <div className="session-top">
            <button className="icon-button" onClick={leaveSession} aria-label="ホームへ戻る">
              ×
            </button>
            <div className="session-title">
              <span>{lessonLabel(selectedLesson)} · {modeLabel(sessionMode, sessionCards.length)}</span>
              <strong>
                {cardIndex + 1}<small> / {sessionCards.length}</small>
              </strong>
            </div>
            <div className="timer" aria-label={`経過時間 ${formatDuration(elapsedSeconds)}`}>
              <span aria-hidden="true">◷</span> {formatDuration(elapsedSeconds)}
            </div>
          </div>

          <div className="progress-track" aria-label="進捗">
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="study-stage">
            <article
              className={`flashcard flashcard--flippable ${
                revealed ? "flashcard--revealed" : ""
              }`}
            >
              <div
                className={`card-face ${
                  revealed ? "card-face--answer" : "card-face--question"
                }`}
                key={revealed ? "answer" : "question"}
              >
                <div className="card-meta card-meta--minimal">
                  <strong>
                    {currentCard.sourceLessonId ? "★" : `Q${String(flashcardNumber(selectedLesson, currentCard.id)).padStart(2, "0")}`}
                  </strong>
                </div>

                {revealed ? (
                  <div className="answer-block" data-testid="answer">
                    {sessionEditField === "answer" ? <textarea className="session-card-editor" value={sessionEditText} onChange={(event) => setSessionEditText(event.target.value)} aria-label="解説を編集" autoFocus /> : <div className="card-copy"><MahjongText text={currentCard.answer} /></div>}
                  </div>
                ) : (
                  <div className="question-text">{sessionEditField === "question" ? <textarea className="session-card-editor session-card-editor--question" value={sessionEditText} onChange={(event) => setSessionEditText(event.target.value)} aria-label="問題を編集" autoFocus /> : <MahjongText text={currentCard.question} />}</div>
                )}

                {sessionEditField ? (
                  <div className="session-edit-actions">
                    <button className="session-edit-cancel" type="button" onClick={cancelSessionEdit} disabled={adminBusyCard !== null}>キャンセル</button>
                    <button className="session-edit-save" type="button" onClick={saveSessionEdit} disabled={adminBusyCard !== null || !sessionEditText.trim()}>{adminBusyCard === currentCard.id ? "保存中…" : "保存"}</button>
                  </div>
                ) : revealed ? (
                  <button
                    className="reveal-button reveal-button--back"
                    type="button"
                    onClick={() => setRevealed(false)}
                    data-testid="show-question"
                  >
                    <span aria-hidden="true">↶</span> 問題を見る
                    <kbd>Space</kbd>
                  </button>
                ) : (
                  <button
                    className="reveal-button"
                    type="button"
                    onClick={() => setRevealed(true)}
                    data-testid="reveal-answer"
                  >
                    答えを見る
                    <kbd>Space</kbd>
                  </button>
                )}
                {!sessionEditField && (
                  <button className="session-edit-button" type="button" onClick={() => beginSessionEdit(revealed ? "answer" : "question")} aria-label={revealed ? "解説を編集" : "問題を編集"}>
                    ✎ {revealed ? "解説を編集" : "問題を編集"}
                  </button>
                )}
              </div>
            </article>
          </div>

          <div className="rating-panel" aria-label="自己判定">
            <div className="rating-actions">
              <button
                className="rating-button rating-button--again"
                onClick={() => rateCard("again")}
                disabled={!revealed || isAdvancing || sessionEditField !== null}
                data-testid="rate-again"
              >
                <span aria-hidden="true">↺</span>
                <strong>解き直しに追加</strong>
                <small>←</small>
              </button>
              <button
                className="rating-button rating-button--known"
                onClick={() => rateCard("known")}
                disabled={!revealed || isAdvancing || sessionEditField !== null}
                data-testid="rate-known"
              >
                <span aria-hidden="true">✓</span>
                <strong>わかった</strong>
                <small>→</small>
              </button>
            </div>
          </div>
          <div className="session-nav" aria-label="カード移動">
            <button type="button" className="session-nav-button session-nav-button--previous" onClick={() => moveSessionCard(-1)} disabled={cardIndex === 0 || isAdvancing || sessionEditField !== null} title="前のカードへ戻る"><span aria-hidden="true">←</span><strong>前のカード</strong></button>
            <button
              type="button"
              className={`session-nav-button session-nav-button--favorite${currentCardIsFavorite ? " session-nav-button--favorite-active" : ""}`}
              onClick={() => currentCardId !== undefined && toggleFavoriteCard(currentCardLessonId, currentCardId)}
              aria-pressed={currentCardIsFavorite}
              title={currentCardIsFavorite ? "お気に入りから削除" : "お気に入りに追加"}
              data-testid="toggle-favorite-session"
            >
              <span aria-hidden="true">★</span><strong>{currentCardIsFavorite ? "お気に入り済み" : "お気に入りに追加"}</strong>
            </button>
            <button type="button" className="session-nav-button session-nav-button--next" onClick={() => moveSessionCard(1)} disabled={cardIndex >= sessionCards.length - 1 || isAdvancing || sessionEditField !== null} title="次のカードへ進む"><strong>次のカード</strong><span aria-hidden="true">→</span></button>
          </div>
        </section>
      )}

      {screen === "result" && lastSession && (
        <section className="screen screen--result" aria-labelledby="result-title">
          <HomeHeader compact iconUrl={appIconUrl} title={appTitle} />
          <div className="result-panel">
            <p className="section-kicker">SESSION COMPLETE</p>
            <h2 id="result-title">おつかれさまでした</h2>
            <p className="result-subtitle">
              {lessonLabel(lastSession.lessonId ?? "tenten")} · {modeLabel(lastSession.mode, lastSession.count)} 完了
            </p>

            <div className="result-score">
              <div
                className="score-gauge"
                style={{ "--score": `${lastSession.rate * 3.6}deg` } as React.CSSProperties}
                aria-label={`わかった率 ${lastSession.rate}%`}
              >
                <div>
                  <strong>{lastSession.rate}</strong>
                  <span>%</span>
                  <small>わかった率</small>
                </div>
              </div>
              <div className={`rank-badge rank-badge--${lastSession.rank.toLowerCase()}`}>
                <span>定着ランク</span>
                <strong>{lastSession.rank}</strong>
                <small>
                  {lastSession.rank === "S" && "しっかり定着！"}
                  {lastSession.rank === "A" && "あと一歩で完全定着"}
                  {lastSession.rank === "B" && "順調に定着中"}
                  {lastSession.rank === "C" && "復習でもう一段"}
                  {lastSession.rank === "D" && "ここから伸びます"}
                </small>
              </div>
            </div>

            <dl className="result-stats">
              <div>
                <dt>わかった</dt>
                <dd>{lastSession.known}<small>問</small></dd>
              </div>
              <div>
                <dt>解き直しに追加</dt>
                <dd>{lastSession.again}<small>問</small></dd>
              </div>
              <div>
                <dt>経過時間</dt>
                <dd>{formatDuration(lastSession.elapsedSeconds)}</dd>
              </div>
            </dl>

            <div className="result-actions">
              <button
                className="primary-button"
                onClick={() => startSession(lastSession.lessonId ?? "tenten", lastSession.mode)}
              >
                同じモードをもう一周
              </button>
              {activeReviewCardIdsByLesson[lastSession.lessonId ?? "tenten"].length > 0 && (
                <button
                  className="review-button"
                  onClick={() => startSession(lastSession.lessonId ?? "tenten", "review")}
                >
                  解き直しカードを復習（{activeReviewCardIdsByLesson[lastSession.lessonId ?? "tenten"].length}枚）
                </button>
              )}
              <button className="text-button" onClick={() => setScreen("home")}>
                ホームへ戻る
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "quiz-list" && (
        <section className="screen screen--list screen--quiz-list" aria-labelledby="quiz-list-title">
          <div className="list-top">
            <button className="icon-button" onClick={() => setScreen("home")} aria-label="ホームへ戻る">
              ←
            </button>
            <div>
              <p className="section-kicker">ALL QUIZ QUESTIONS</p>
              <h2 id="quiz-list-title">クイズ問題一覧</h2>
            </div>
            <span className="review-count">
              解き直し <strong>{activeQuizReviewIds.length}</strong>問
            </span>
          </div>

          <div className="quiz-list-toolbar">
            <button className="primary-button" onClick={() => startQuiz()}>全{quizBank.length}問を解く</button>
            <button
              className="review-button"
              onClick={() => startQuiz(quizBank.filter((question) => quizReviewSet.has(question.id)))}
              disabled={activeQuizReviewIds.length === 0}
            >
              解き直し{activeQuizReviewIds.length}問を解く
            </button>
          </div>

          <p className="list-lead">
            問題を開くと正解と解説を確認できます。気になる問題は一覧からも解き直しに追加できます。
          </p>

          <div className="question-list quiz-question-list">
            {quizBank.map((question, questionIndex) => (
              <details
                key={question.id}
                className={quizReviewSet.has(question.id) ? "question-row question-row--review" : "question-row"}
              >
                <summary>
                  <span className="question-number">Q{String(questionIndex + 1).padStart(2, "0")}</span>
                  <span><MahjongText text={question.question} /></span>
                  {quizReviewSet.has(question.id) && <span className="review-tag">解き直し</span>}
                  <span className="chevron" aria-hidden="true">＋</span>
                </summary>
                <div className="quiz-list-answer">
                  <p className="quiz-list-chapter">{question.chapter}</p>
                  <ol className="quiz-list-options">
                    {question.options.map((option, optionIndex) => (
                      <li
                        key={`${question.id}-list-${optionIndex}`}
                        className={optionIndex === question.correctIndex ? "is-correct" : ""}
                      >
                        <strong>{choiceLabel(optionIndex)}</strong>
                        <span><MahjongText text={option} /></span>
                      </li>
                    ))}
                  </ol>
                  <div className="quiz-list-explanation">
                    <strong>正解 {choiceLabel(question.correctIndex)}</strong>
                    <p><MahjongText text={question.explanation} /></p>
                  </div>
                  <button
                    className={`quiz-review-toggle${quizReviewSet.has(question.id) ? " quiz-review-toggle--active" : ""}`}
                    onClick={() => toggleQuizReview(question.id)}
                  >
                    <span aria-hidden="true">↺</span>
                    {quizReviewSet.has(question.id) ? "解き直しから外す" : "解き直しに追加"}
                  </button>
                </div>
              </details>
            ))}
          </div>

          <button className="sticky-home-button" onClick={() => setScreen("home")}>
            ホームへ戻る
          </button>
        </section>
      )}

      {screen === "favorites" && (
        <section className="screen screen--list screen--favorites" aria-labelledby="favorites-title">
          <div className="list-top">
            <button className="icon-button" onClick={() => setScreen("home")} aria-label="ホームへ戻る">←</button>
            <div>
              <p className="section-kicker">MY FAVORITES</p>
              <h2 id="favorites-title">お気に入り</h2>
            </div>
            <span className="review-count"><strong>{favoriteCards.length}</strong>枚</span>
          </div>
          <p className="list-lead">気になった問題を授業をまたいでまとめて確認できます。</p>
          {favoriteCards.length === 0 ? (
            <p className="empty-state">お気に入りに追加した問題はここに並びます。</p>
          ) : (
            <div className="question-list">
              {favoriteCards.map(({ lessonId, card }) => (
                <details className="question-row question-row--favorite" key={`${lessonId}-${card.id}`}>
                  <summary>
                    <span className="question-number">★</span>
                    <span><small className="favorite-lesson-label">{lessonLabel(lessonId)}</small><MahjongText text={card.question} /></span>
                    <span className="chevron" aria-hidden="true">＋</span>
                  </summary>
                  <div className="list-answer">
                    <span>ANSWER</span>
                    <p><MahjongText text={card.answer} /></p>
                    <div className="list-card-actions">
                      <button type="button" className="list-edit-button" onClick={() => { setSelectedLesson(lessonId); setScreen("list"); }}>この授業の問題一覧へ</button>
                      <button type="button" className="list-delete-button" onClick={() => toggleFavoriteCard(lessonId, card.id)} title="お気に入りから削除">お気に入りから外す</button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
          <button className="sticky-home-button" onClick={() => setScreen("home")}>ホームへ戻る</button>
        </section>
      )}

      {screen === "list" && (
        <section className="screen screen--list" aria-labelledby="list-title">
          <div className="list-top">
            <button className="icon-button" onClick={() => setScreen("home")} aria-label="ホームへ戻る">
              ←
            </button>
            <div>
              <p className="section-kicker">ALL FLASHCARDS</p>
              <h2 id="list-title"><LessonTitle label={lessonLabel(selectedLesson)} /></h2>
            </div>
            <span className="review-count">
              解き直し <strong>{reviewCardIds.length}</strong>枚
            </span>
          </div>

          <p className="list-lead">
            全{cardsByLesson[selectedLesson].length}問の問題一覧。タップすると答えが開きます。
            <span className="review-dot" /> は「解き直しに追加」したカードです。
          </p>

          <div className="list-toolbar">
            <button className="primary-button list-add-button" type="button" onClick={addCardFromList} disabled={adminBusyCard !== null} data-testid="add-card-from-list">
              ＋ 問題を追加
            </button>
            <span>ドラッグで順番を変更できます</span>
          </div>

          <div className="question-list">
            {cardsByLesson[selectedLesson].map((card, cardNumber) => (
              <details
                key={card.id}
                className={reviewSet.has(card.id) ? "question-row question-row--review" : "question-row"}
                draggable={listEditDraft?.id !== card.id}
                onDragStart={(event) => {
                  if (listEditDraft?.id === card.id) {
                    event.preventDefault();
                    return;
                  }
                  setDraggedCard({ lessonId: selectedLesson, cardId: card.id });
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropCard(selectedLesson, card.id)}
              >
                <summary>
                  <span className="question-number">↕ Q{String(cardNumber + 1).padStart(2, "0")}</span>
                  <span><MahjongText text={card.question} /></span>
                  {reviewSet.has(card.id) && <span className="review-tag">解き直し</span>}
                  <button
                    type="button"
                    className={`favorite-toggle favorite-toggle--list${favoriteSet.has(card.id) ? " favorite-toggle--active" : ""}`}
                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggleFavoriteCard(selectedLesson, card.id); }}
                    aria-pressed={favoriteSet.has(card.id)}
                    aria-label={favoriteSet.has(card.id) ? `Q${cardNumber + 1}をお気に入りから外す` : `Q${cardNumber + 1}をお気に入りに追加`}
                    title={favoriteSet.has(card.id) ? "お気に入りから外す" : "お気に入りに追加"}
                    data-testid={`toggle-favorite-list-${card.id}`}
                  >
                    ★
                  </button>
                  <span className="chevron" aria-hidden="true">＋</span>
                </summary>
                <div className="list-answer">
                  {listEditDraft?.id === card.id ? (
                    <div className="list-card-editor">
                      <label>問題文<textarea value={listEditDraft.question} onChange={(event) => setListEditDraft((current) => current ? { ...current, question: event.target.value } : current)} /></label>
                      <label className="list-image-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void appendListImage("question", file); }}>
                        問題に画像をドロップ
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void appendListImage("question", file); event.currentTarget.value = ""; }} />
                      </label>
                      <label className="list-image-drop list-image-drop--replace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void replaceListImage("question", file); }}>
                        問題の画像を差し替え
                        <small>最初の画像を置き換えます</small>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceListImage("question", file); event.currentTarget.value = ""; }} />
                      </label>
                      <label>解説<textarea value={listEditDraft.answer} onChange={(event) => setListEditDraft((current) => current ? { ...current, answer: event.target.value } : current)} /></label>
                      <label className="list-image-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void appendListImage("answer", file); }}>
                        解説に画像をドロップ
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void appendListImage("answer", file); event.currentTarget.value = ""; }} />
                      </label>
                      <label className="list-image-drop list-image-drop--replace" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void replaceListImage("answer", file); }}>
                        解説の画像を差し替え
                        <small>最初の画像を置き換えます</small>
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceListImage("answer", file); event.currentTarget.value = ""; }} />
                      </label>
                      <div className="list-edit-actions"><button type="button" onClick={() => setListEditDraft(null)} disabled={adminBusyCard !== null}>キャンセル</button><button type="button" onClick={saveListEdit} disabled={adminBusyCard !== null || !listEditDraft.question.trim() || !listEditDraft.answer.trim()}>{adminBusyCard === card.id ? "保存中…" : "保存"}</button></div>
                    </div>
                  ) : <>
                    <span>ANSWER</span>
                    <p><MahjongText text={card.answer} /></p>
                    <div className="list-card-actions">
                      <button type="button" className="list-edit-button" onClick={() => beginListEdit(card)}>✎ 編集</button>
                      <button
                        type="button"
                        className="list-delete-button"
                        onClick={() => deleteCardFromList(card, cardNumber + 1)}
                        disabled={adminBusyCard !== null}
                      >
                        {isBaseLessonId(selectedLesson) && adminPendingDelete === `card-${selectedLesson}-${card.id}` ? "削除を確定" : "削除"}
                      </button>
                    </div>
                  </>}
                </div>
              </details>
            ))}
          </div>

          <div className="list-add-bottom">
            <button className="primary-button list-add-button" type="button" onClick={addCardFromList} disabled={adminBusyCard !== null} data-testid="add-card-from-list-bottom">
              ＋ 問題を追加
            </button>
          </div>

          <button className="sticky-home-button" onClick={() => setScreen("home")}>
            ホームへ戻る
          </button>
        </section>
      )}
    </main>
  );
}
