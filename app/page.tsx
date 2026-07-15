"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APP_VERSION,
  FLASHCARDS,
  STORAGE_KEY,
  createSessionCards,
  formatDuration,
  getRank,
  readProgress,
  updateReviewIds,
} from "./lib/flashcards.mjs";

type Screen = "home" | "session" | "result" | "list";
type SessionMode = "all" | "review";
type Rating = "known" | "again";
type Flashcard = (typeof FLASHCARDS)[number];
type LastSession = {
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

type Suit = "m" | "p" | "s";

const SUITS: Record<Suit, { prefix: string; label: string }> = {
  m: { prefix: "man", label: "萬" },
  p: { prefix: "pin", label: "筒" },
  s: { prefix: "sou", label: "索" },
};

function normalizeDigits(value: string) {
  return value.replace(/[１-９]/g, (digit) =>
    String("１２３４５６７８９".indexOf(digit) + 1),
  );
}

function tilePath(suit: Suit, digit: string) {
  return `/tiles/${SUITS[suit].prefix}${digit}-66-90-l.png`;
}

function MahjongText({ text }: { text: string }) {
  const pattern = /([1-9１-９]+)[ \u3000]*([mpsｍｐｓ])/giu;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    const digits = normalizeDigits(match[1]);
    const suit = match[2].normalize("NFKC").toLowerCase() as Suit;
    parts.push(
      <span className="tile-run" key={`${match.index}-${match[0]}`} aria-label={`${digits}${suit}`}>
        {digits.split("").map((digit, index) => (
          <span className="tile-slot" key={`${digit}-${index}`}>
            {/* Approved tile PNGs keep their original 66×90 dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="tile-image"
              src={tilePath(suit, digit)}
              width="66"
              height="90"
              alt={`${digit}${SUITS[suit].label}`}
              loading="eager"
              onError={(event) => {
                event.currentTarget.hidden = true;
                const fallback = event.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.hidden = false;
              }}
            />
            <span className="tile-fallback" hidden aria-hidden="true">
              {digit}{suit}
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

function safeSave(reviewCardIds: number[], lastSession: LastSession | null) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ reviewCardIds, lastSession }),
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
  const [reviewCardIds, setReviewCardIds] = useState<number[]>([]);
  const [lastSession, setLastSession] = useState<LastSession | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode>("all");
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const startedAtRef = useRef(0);
  const resultRef = useRef<LastSession | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = readProgress(window.localStorage.getItem(STORAGE_KEY));
        setReviewCardIds(stored.reviewCardIds);
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
  }, []);

  useEffect(() => {
    if (screen !== "session") return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  const reviewSet = useMemo(() => new Set(reviewCardIds), [reviewCardIds]);
  const currentCard = sessionCards[cardIndex];
  const progress = sessionCards.length
    ? ((cardIndex + (revealed ? 0.5 : 0)) / sessionCards.length) * 100
    : 0;

  const startSession = useCallback(
    (mode: SessionMode) => {
      const cards = createSessionCards(mode, reviewCardIds) as Flashcard[];
      if (cards.length === 0) return;
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
    [reviewCardIds],
  );

  const rateCard = useCallback(
    (rating: Rating) => {
      if (!revealed || isAdvancing || !currentCard) return;
      setIsAdvancing(true);

      const nextReviewIds = updateReviewIds(
        reviewCardIds,
        currentCard.id,
        rating,
      );
      const nextKnown = knownCount + (rating === "known" ? 1 : 0);
      const nextAgain = againCount + (rating === "again" ? 1 : 0);
      const isLast = cardIndex >= sessionCards.length - 1;

      setReviewCardIds(nextReviewIds);
      setKnownCount(nextKnown);
      setAgainCount(nextAgain);

      if (isLast) {
        const finalElapsed = Math.floor(
          (Date.now() - startedAtRef.current) / 1000,
        );
        const rate = Math.round((nextKnown / sessionCards.length) * 100);
        const result: LastSession = {
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
        safeSave(nextReviewIds, result);
      } else {
        safeSave(nextReviewIds, lastSession);
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
      reviewCardIds,
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

  const leaveSession = () => {
    setScreen("home");
    setSessionCards([]);
    setIsAdvancing(false);
  };

  return (
    <main className="app-shell">
      <div className="felt-grain" aria-hidden="true" />

      {screen === "home" && (
        <section className="screen screen--home" aria-labelledby="app-title">
          <HomeHeader />

          <div className="hero-panel">
            <div className="hero-copy">
              <p className="hero-kicker">50 CARDS / SELF CHECK</p>
              <h2 id="app-title">授業の復習</h2>
              <p>
                問題を読んで答えを思い浮かべたら、カードをめくって自己判定。
                解き直しカードだけを何度でも復習できます。
              </p>
            </div>
            <div className="hero-seal" aria-hidden="true">
              <span>基礎</span>
              <strong>一向聴</strong>
              <small>DRILL</small>
            </div>
          </div>

          <section className="mode-panel" aria-label="7/14　てんてん授業">
            <div className="section-heading">
              <div>
                <p className="section-kicker">SELECT MODE</p>
                <h2>7/14　てんてん授業</h2>
              </div>
              <span className="review-count">
                解き直し <strong>{reviewCardIds.length}</strong>枚
              </span>
            </div>

            <div className="mode-grid">
              <button
                className="mode-card mode-card--primary"
                onClick={() => startSession("all")}
                data-testid="start-all"
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
                onClick={() => startSession("review")}
                disabled={reviewCardIds.length === 0}
                data-testid="start-review"
              >
                <span className="mode-card__number">↺</span>
                <span>
                  <strong>解き直しカード</strong>
                  <small>
                    {reviewCardIds.length
                      ? `${reviewCardIds.length}枚を解き直す`
                      : "回答後に追加できます"}
                  </small>
                </span>
                <span className="mode-card__arrow" aria-hidden="true">→</span>
              </button>
            </div>
          </section>

          <div className="home-footer">
            <button className="text-button" onClick={() => setScreen("list")}>
              <span aria-hidden="true">☰</span> 問題一覧を見る
            </button>
            {lastSession && (
              <p className="last-result">
                前回：{MODE_LABELS[lastSession.mode]}・
                <strong>{lastSession.rate}%</strong>・ランク
                <strong>{lastSession.rank}</strong>
              </p>
            )}
          </div>
        </section>
      )}

      {screen === "session" && currentCard && (
        <section className="screen screen--session" aria-live="polite">
          <div className="session-top">
            <button className="icon-button" onClick={leaveSession} aria-label="ホームへ戻る">
              ×
            </button>
            <div className="session-title">
              <span>{MODE_LABELS[sessionMode]}</span>
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
            <p className="result-subtitle">{MODE_LABELS[lastSession.mode]} 完了</p>

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
              <button className="primary-button" onClick={() => startSession(lastSession.mode)}>
                同じモードをもう一周
              </button>
              {reviewCardIds.length > 0 && (
                <button className="review-button" onClick={() => startSession("review")}>
                  解き直しカードを復習（{reviewCardIds.length}枚）
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
              <h2 id="list-title">問題一覧</h2>
            </div>
            <span className="review-count">
              解き直し <strong>{reviewCardIds.length}</strong>枚
            </span>
          </div>

          <p className="list-lead">
            全50問。タップすると答えが開きます。
            <span className="review-dot" /> は「解き直しに追加」したカードです。
          </p>

          <div className="question-list">
            {FLASHCARDS.map((card) => (
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
