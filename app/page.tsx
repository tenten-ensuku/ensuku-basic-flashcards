"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APP_VERSION,
  LEGACY_STORAGE_KEY,
  LESSONS,
  STORAGE_KEY,
  createSessionCards,
  formatDuration,
  getRank,
  readProgress,
  updateReviewIds,
} from "./lib/flashcards.mjs";
import {
  BASIC_ORDER_QUIZ,
  QUIZ_LESSON,
  choiceLabel,
  mergeQuizOverrides,
  scoreQuiz,
} from "./lib/quiz.mjs";

type Screen = "home" | "session" | "result" | "list" | "quiz" | "quiz-result" | "admin-login" | "admin";
type SessionMode = "all" | "review";
type Rating = "known" | "again";
type LessonId = keyof typeof LESSONS;
type Flashcard = { id: number; question: string; answer: string };
type CardsByLesson = Record<LessonId, Flashcard[]>;
type CardOverride = Flashcard & { lessonId: LessonId };
type QuizQuestion = {
  id: number;
  chapter: string;
  question: string;
  options: readonly string[];
  correctIndex: number;
  explanation: string;
};
type QuizOverride = Omit<QuizQuestion, "chapter"> & { quizId: string };
type AdminSection = LessonId | "quiz";
type QuizAnswer = {
  questionId: number;
  selectedIndex: number;
  correct: boolean;
};
type ReviewCardIdsByLesson = Record<LessonId, number[]>;
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

const MODE_LABELS: Record<SessionMode, string> = {
  all: "全50問",
  review: "解き直しカード",
};

const ADMIN_SECTIONS: ReadonlyArray<{ id: AdminSection; label: string }> = [
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

function cloneBaseCards(): CardsByLesson {
  return {
    tenten: LESSONS.tenten.cards.map((card) => ({ ...card })),
    nejimaki: LESSONS.nejimaki.cards.map((card) => ({ ...card })),
  };
}

function withOverrides(overrides: CardOverride[]): CardsByLesson {
  const cards = cloneBaseCards();
  for (const override of overrides) {
    if (!(override.lessonId in cards)) continue;
    const index = cards[override.lessonId].findIndex((card) => card.id === override.id);
    if (index >= 0 && override.question && override.answer) {
      cards[override.lessonId][index] = {
        id: override.id,
        question: override.question,
        answer: override.answer,
      };
    }
  }
  return cards;
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

function MahjongText({ text }: { text: string }) {
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

function safeSave(reviewCardIdsByLesson: ReviewCardIdsByLesson, lastSession: LastSession | null) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reviewCardIdsByLesson, lastSession }),
    );
  } catch {
    // 保存不可でも、現在のセッションはそのまま続ける。
  }
}

function HomeHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={compact ? "brand brand--compact" : "brand"}>
      <div className="brand__mark" aria-hidden="true">
        向
      </div>
      <div>
        <p className="brand__eyebrow">ENSUKU BASIC LECTURE</p>
        <h1>一向聴 基礎講義フラッシュカード</h1>
      </div>
      <span className="version">ver{APP_VERSION}</span>
    </header>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [cardsByLesson, setCardsByLesson] = useState<CardsByLesson>(cloneBaseCards);
  const [adminDrafts, setAdminDrafts] = useState<CardsByLesson>(cloneBaseCards);
  const [quizBank, setQuizBank] = useState<QuizQuestion[]>(cloneBaseQuiz);
  const [adminQuizDrafts, setAdminQuizDrafts] = useState<QuizQuestion[]>(cloneBaseQuiz);
  const [adminSection, setAdminSection] = useState<AdminSection>("quiz");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [adminBusyCard, setAdminBusyCard] = useState<number | null>(null);
  const [reviewCardIdsByLesson, setReviewCardIdsByLesson] = useState<ReviewCardIdsByLesson>({
    tenten: [],
    nejimaki: [],
  });
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<LessonId>("tenten");
  const [sessionMode, setSessionMode] = useState<SessionMode>("all");
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedIndex, setQuizSelectedIndex] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const startedAtRef = useRef(0);
  const resultRef = useRef<LastSession | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(adminApiPath("/api/cards"), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("問題データを取得できませんでした。");
        return response.json() as Promise<{ overrides?: CardOverride[]; quizOverrides?: QuizOverride[] }>;
      })
      .then(({ overrides = [], quizOverrides = [] }) => {
        const nextCards = withOverrides(overrides);
        const nextQuiz = withQuizOverrides(quizOverrides);
        setCardsByLesson(nextCards);
        setAdminDrafts(nextCards);
        setQuizBank(nextQuiz);
        setAdminQuizDrafts(nextQuiz);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // APIに接続できない場合も、収録済みの問題で学習を続けられる。
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
          ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
        const stored = readProgress(raw);
        setReviewCardIdsByLesson(stored.reviewCardIdsByLesson);
        setLastSession(stored.lastSession as LastSession | null);
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

  const reviewCardIds = reviewCardIdsByLesson[selectedLesson];
  const reviewSet = useMemo(() => new Set(reviewCardIds), [reviewCardIds]);
  const currentCard = sessionCards[cardIndex];
  const currentQuizQuestion = quizQuestions[quizIndex];
  const progress = sessionCards.length
    ? ((cardIndex + (revealed ? 0.5 : 0)) / sessionCards.length) * 100
    : 0;
  const quizProgress = quizQuestions.length
    ? ((quizIndex + (quizSelectedIndex === null ? 0 : 1)) / quizQuestions.length) * 100
    : 0;
  const quizResult = useMemo(
    () => scoreQuiz(quizAnswers, quizQuestions.length),
    [quizAnswers, quizQuestions.length],
  );
  const missedQuizQuestions = useMemo(() => {
    const missedIds = new Set(quizAnswers.filter((answer) => !answer.correct).map((answer) => answer.questionId));
    return quizQuestions.filter((question) => missedIds.has(question.id));
  }, [quizAnswers, quizQuestions]);

  const startSession = useCallback(
    (lessonId: LessonId, mode: SessionMode) => {
      const cards = createSessionCards(
        lessonId,
        mode,
        reviewCardIdsByLesson[lessonId],
        cardsByLesson[lessonId],
      ) as Flashcard[];
      if (cards.length === 0) return;
      setSelectedLesson(lessonId);
      setSessionMode(mode);
      setSessionCards(cards);
      setCardIndex(0);
      setRevealed(false);
      setKnownCount(0);
      setAgainCount(0);
      setElapsedSeconds(0);
      setIsAdvancing(false);
      resultRef.current = null;
      startedAtRef.current = Date.now();
      setScreen("session");
    },
    [cardsByLesson, reviewCardIdsByLesson],
  );

  const startQuiz = useCallback((questions?: readonly QuizQuestion[]) => {
    const source = questions ?? quizBank;
    if (!source.length) return;
    setQuizQuestions(source.map((question) => ({ ...question, options: [...question.options] })));
    setQuizIndex(0);
    setQuizSelectedIndex(null);
    setQuizAnswers([]);
    setElapsedSeconds(0);
    startedAtRef.current = Date.now();
    setScreen("quiz");
  }, [quizBank]);

  const answerQuiz = useCallback((selectedIndex: number) => {
    if (!currentQuizQuestion || quizSelectedIndex !== null) return;
    if (selectedIndex < 0 || selectedIndex >= currentQuizQuestion.options.length) return;
    setQuizSelectedIndex(selectedIndex);
    setQuizAnswers((answers) => [
      ...answers,
      {
        questionId: currentQuizQuestion.id,
        selectedIndex,
        correct: selectedIndex === currentQuizQuestion.correctIndex,
      },
    ]);
  }, [currentQuizQuestion, quizSelectedIndex]);

  const advanceQuiz = useCallback(() => {
    if (quizSelectedIndex === null || !currentQuizQuestion) return;
    if (quizIndex >= quizQuestions.length - 1) {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setScreen("quiz-result");
      return;
    }
    setQuizIndex((index) => index + 1);
    setQuizSelectedIndex(null);
  }, [currentQuizQuestion, quizIndex, quizQuestions.length, quizSelectedIndex]);

  const openAdminLogin = () => {
    setAdminPassword("");
    setAdminError("");
    setAdminNotice("");
    setScreen("admin-login");
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

  const updateAdminDraft = (lessonId: LessonId, cardId: number, field: "question" | "answer", value: string) => {
    setAdminDrafts((current) => ({
      ...current,
      [lessonId]: current[lessonId].map((card) =>
        card.id === cardId ? { ...card, [field]: value } : card,
      ),
    }));
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

  const saveAdminCard = async (lessonId: LessonId, card: Flashcard) => {
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
      setAdminNotice(`Q${String(card.id).padStart(2, "0")}を保存しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "保存できませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const restoreAdminCard = async (lessonId: LessonId, cardId: number) => {
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
        [lessonId]: current[lessonId].map((item) => item.id === cardId ? restoredCard : item),
      }));
      setAdminDrafts((current) => ({
        ...current,
        [lessonId]: current[lessonId].map((item) => item.id === cardId ? restoredCard : item),
      }));
      setAdminNotice(`Q${String(cardId).padStart(2, "0")}を初期文に戻しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "初期文に戻せませんでした。");
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
      setAdminNotice(`4択クイズ Q${String(question.id).padStart(2, "0")}を保存しました。`);
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
      setQuizBank((current) => current.map((item) => item.id === questionId ? restoredQuestion : item));
      setAdminQuizDrafts((current) => current.map((item) => item.id === questionId ? restoredQuestion : item));
      setAdminNotice(`4択クイズ Q${String(questionId).padStart(2, "0")}を初期文に戻しました。`);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : "初期文に戻せませんでした。");
    } finally {
      setAdminBusyCard(null);
    }
  };

  const leaveAdmin = () => {
    setAdminPassword("");
    setAdminError("");
    setAdminNotice("");
    setScreen("home");
  };

  const rateCard = useCallback(
    (rating: Rating) => {
      if (!revealed || isAdvancing || !currentCard) return;
      setIsAdvancing(true);

      const nextReviewIds = updateReviewIds(
        reviewCardIdsByLesson[selectedLesson],
        currentCard.id,
        rating,
      );
      const nextReviewCardIdsByLesson = {
        ...reviewCardIdsByLesson,
        [selectedLesson]: nextReviewIds,
      };
      const nextKnown = knownCount + (rating === "known" ? 1 : 0);
      const nextAgain = againCount + (rating === "again" ? 1 : 0);
      const isLast = cardIndex >= sessionCards.length - 1;

      setReviewCardIdsByLesson(nextReviewCardIdsByLesson);
      setKnownCount(nextKnown);
      setAgainCount(nextAgain);

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
        safeSave(nextReviewCardIdsByLesson, result);
      } else {
        safeSave(nextReviewCardIdsByLesson, lastSession);
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
      reviewCardIdsByLesson,
      selectedLesson,
      sessionCards.length,
      sessionMode,
    ],
  );

  useEffect(() => {
    if (screen !== "session") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
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
  }, [rateCard, revealed, screen]);

  useEffect(() => {
    if (screen !== "quiz") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (quizSelectedIndex !== null && event.key === "Enter") {
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
  }, [advanceQuiz, answerQuiz, quizSelectedIndex, screen]);

  const leaveSession = () => {
    setScreen("home");
    setSessionCards([]);
    setIsAdvancing(false);
  };

  const leaveQuiz = () => {
    setScreen("home");
    setQuizQuestions([]);
    setQuizSelectedIndex(null);
    setQuizAnswers([]);
  };

  return (
    <main className="app-shell">
      <div className="felt-grain" aria-hidden="true" />

      {screen === "home" && (
        <section className="screen screen--home" aria-labelledby="app-title">
          <HomeHeader />

          <div className="hero-panel">
            <div className="hero-copy">
              <p className="hero-kicker">1 QUIZ / 2 FLASHCARD LESSONS</p>
              <h2 id="app-title">授業の復習</h2>
              <p>
                4択クイズで理解を確認したり、カードをめくって思い出す練習をしたり。
                授業ごとに、自分のペースで何度でも復習できます。
              </p>
            </div>
            <div className="hero-seal" aria-hidden="true">
              <span>基礎</span>
              <strong>一向聴</strong>
              <small>DRILL</small>
            </div>
          </div>

          <section className="quiz-launch-panel" aria-labelledby="quiz-launch-title">
            <div className="quiz-launch-copy">
              <div className="quiz-launch-meta">
                <span>NEW · 4択30問</span>
                <span>7章構成</span>
              </div>
              <p className="section-kicker">MULTIPLE CHOICE QUIZ</p>
              <h2 id="quiz-launch-title">{QUIZ_LESSON.label}</h2>
              <h3>{QUIZ_LESSON.title}</h3>
              <p>孤立牌の基本序列から特殊形まで、選んですぐ解説を確認できます。</p>
            </div>
            <div className="quiz-launch-actions">
              <button className="quiz-start-button" onClick={() => startQuiz()} data-testid="start-basic-order-quiz">
                <span className="quiz-start-button__count">30</span>
                <span>
                  <strong>クイズを始める</strong>
                  <small>全30問・4択形式</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
              <a className="quiz-video-link" href={QUIZ_LESSON.videoUrl} target="_blank" rel="noreferrer">
                <span aria-hidden="true">▶</span> 授業動画を見る
              </a>
            </div>
          </section>

          {(Object.keys(LESSONS) as LessonId[]).map((lessonId) => {
            const lesson = LESSONS[lessonId];
            const lessonReviewIds = reviewCardIdsByLesson[lessonId];
            return (
              <section className="mode-panel" aria-label={lesson.label} key={lessonId}>
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">SELECT MODE</p>
                    <div className="lesson-title-row">
                      <h2>{lesson.label}</h2>
                      <a
                        className="youtube-icon-button"
                        href={lesson.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${lesson.label}の授業動画をYouTubeで見る`}
                        title="授業動画をYouTubeで見る"
                      >
                        <span className="youtube-play-mark" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                  <span className="review-count">
                    解き直し <strong>{lessonReviewIds.length}</strong>枚
                  </span>
                </div>

                <div className="mode-grid">
                  <button
                    className="mode-card mode-card--primary"
                    onClick={() => startSession(lessonId, "all")}
                    data-testid={`start-all-${lessonId}`}
                  >
                    <span className="mode-card__number">50</span>
                    <span>
                      <strong>全50問</strong>
                      <small>講義内容を一周する</small>
                    </span>
                    <span className="mode-card__arrow" aria-hidden="true">→</span>
                  </button>
                  <button
                    className="mode-card mode-card--review"
                    onClick={() => startSession(lessonId, "review")}
                    disabled={lessonReviewIds.length === 0}
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
              </section>
            );
          })}

          <div className="home-footer">
            {lastSession && (
              <p className="last-result">
                前回：{LESSONS[lastSession.lessonId ?? "tenten"].label}・{MODE_LABELS[lastSession.mode]}・
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
            <button className="icon-button" onClick={leaveQuiz} aria-label="クイズを終了してホームへ戻る">×</button>
            <div className="session-title">
              <span>{QUIZ_LESSON.label} · 4択クイズ</span>
              <strong>{quizIndex + 1}<small> / {quizQuestions.length}</small></strong>
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
              <strong>Q{String(currentQuizQuestion.id).padStart(2, "0")}</strong>
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
                    <span><MahjongText text={option} /></span>
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
                <button className="quiz-next-button" onClick={advanceQuiz} data-testid="quiz-next">
                  {quizIndex >= quizQuestions.length - 1 ? "結果を見る" : "次の問題へ"}
                  <span aria-hidden="true">→</span>
                  <kbd>Enter</kbd>
                </button>
              </div>
            )}
          </article>
        </section>
      )}

      {screen === "quiz-result" && (
        <section className="screen screen--result" aria-labelledby="quiz-result-title">
          <HomeHeader compact />
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
                      <span>Q{String(question.id).padStart(2, "0")}</span>
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

          {adminSection === "quiz" ? (
            <div className="admin-card-list" data-testid="admin-quiz-list">
              {adminQuizDrafts.map((question) => {
                const publishedQuestion = quizBank[question.id - 1];
                const baseQuestion = BASIC_ORDER_QUIZ[question.id - 1];
                const isChanged = !quizQuestionsEqual(question, publishedQuestion);
                const hasOverride = !quizQuestionsEqual(publishedQuestion, baseQuestion);
                const isComplete = question.question.trim()
                  && question.explanation.trim()
                  && question.options.every((option) => option.trim());
                return (
                  <details className="admin-card-editor" key={`quiz-${question.id}`}>
                    <summary>
                      <span>Q{String(question.id).padStart(2, "0")}</span>
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
            </div>
          ) : (
            <div className="admin-card-list">
              {adminDrafts[adminSection].map((card) => {
                const isChanged = card.question !== cardsByLesson[adminSection][card.id - 1]?.question
                  || card.answer !== cardsByLesson[adminSection][card.id - 1]?.answer;
                const hasOverride = cardsByLesson[adminSection][card.id - 1]?.question !== LESSONS[adminSection].cards[card.id - 1]?.question
                  || cardsByLesson[adminSection][card.id - 1]?.answer !== LESSONS[adminSection].cards[card.id - 1]?.answer;
                return (
                  <details className="admin-card-editor" key={`${adminSection}-${card.id}`}>
                    <summary>
                      <span>Q{String(card.id).padStart(2, "0")}</span>
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
                      <label htmlFor={`answer-${adminSection}-${card.id}`}>解答文</label>
                      <textarea
                        id={`answer-${adminSection}-${card.id}`}
                        value={card.answer}
                        onChange={(event) => updateAdminDraft(adminSection, card.id, "answer", event.target.value)}
                        rows={6}
                      />
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
              <span>{LESSONS[selectedLesson].label} · {MODE_LABELS[sessionMode]}</span>
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
            <article className={`flashcard ${revealed ? "flashcard--revealed" : ""}`}>
              <div className="card-meta">
                <span>QUESTION</span>
                <strong>Q{String(currentCard.id).padStart(2, "0")}</strong>
              </div>
              <p className="question-text"><MahjongText text={currentCard.question} /></p>

              <div className="answer-divider">
                <span>{revealed ? "ANSWER" : "THINK & REVEAL"}</span>
              </div>

              {revealed ? (
                <div className="answer-block" data-testid="answer">
                  <p><MahjongText text={currentCard.answer} /></p>
                </div>
              ) : (
                <button
                  className="reveal-button"
                  onClick={() => setRevealed(true)}
                  data-testid="reveal-answer"
                >
                  <span aria-hidden="true">◉</span> 答えを見る
                  <kbd>Space</kbd>
                </button>
              )}
            </article>
          </div>

          <div className="rating-panel" aria-label="自己判定">
            <p>思い出せましたか？</p>
            <div className="rating-actions">
              <button
                className="rating-button rating-button--again"
                onClick={() => rateCard("again")}
                disabled={!revealed || isAdvancing}
                data-testid="rate-again"
              >
                <span aria-hidden="true">↺</span>
                <strong>解き直しに追加</strong>
                <small>←</small>
              </button>
              <button
                className="rating-button rating-button--known"
                onClick={() => rateCard("known")}
                disabled={!revealed || isAdvancing}
                data-testid="rate-known"
              >
                <span aria-hidden="true">✓</span>
                <strong>わかった</strong>
                <small>→</small>
              </button>
            </div>
          </div>
        </section>
      )}

      {screen === "result" && lastSession && (
        <section className="screen screen--result" aria-labelledby="result-title">
          <HomeHeader compact />
          <div className="result-panel">
            <p className="section-kicker">SESSION COMPLETE</p>
            <h2 id="result-title">おつかれさまでした</h2>
            <p className="result-subtitle">
              {LESSONS[lastSession.lessonId ?? "tenten"].label} · {MODE_LABELS[lastSession.mode]} 完了
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
              {reviewCardIdsByLesson[lastSession.lessonId ?? "tenten"].length > 0 && (
                <button
                  className="review-button"
                  onClick={() => startSession(lastSession.lessonId ?? "tenten", "review")}
                >
                  解き直しカードを復習（{reviewCardIdsByLesson[lastSession.lessonId ?? "tenten"].length}枚）
                </button>
              )}
              <button className="text-button" onClick={() => setScreen("home")}>
                ホームへ戻る
              </button>
            </div>
          </div>
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
              <h2 id="list-title">{LESSONS[selectedLesson].label}</h2>
            </div>
            <span className="review-count">
              解き直し <strong>{reviewCardIds.length}</strong>枚
            </span>
          </div>

          <p className="list-lead">
            全50問の問題一覧。タップすると答えが開きます。
            <span className="review-dot" /> は「解き直しに追加」したカードです。
          </p>

          <div className="question-list">
            {cardsByLesson[selectedLesson].map((card) => (
              <details
                key={card.id}
                className={reviewSet.has(card.id) ? "question-row question-row--review" : "question-row"}
              >
                <summary>
                  <span className="question-number">Q{String(card.id).padStart(2, "0")}</span>
                  <span><MahjongText text={card.question} /></span>
                  {reviewSet.has(card.id) && <span className="review-tag">解き直し</span>}
                  <span className="chevron" aria-hidden="true">＋</span>
                </summary>
                <div className="list-answer">
                  <span>ANSWER</span>
                  <p><MahjongText text={card.answer} /></p>
                </div>
              </details>
            ))}
          </div>

          <button className="sticky-home-button" onClick={() => setScreen("home")}>
            ホームへ戻る
          </button>
        </section>
      )}
    </main>
  );
}
