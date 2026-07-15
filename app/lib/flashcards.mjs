export const APP_VERSION = 2;
export const STORAGE_KEY = "ensuku-basic-flashcards-v1";

/** @typedef {{ id: number, question: string, answer: string }} Flashcard */
/** @typedef {"quick" | "all" | "review"} SessionMode */

/** @type {ReadonlyArray<Flashcard>} */
export const FLASHCARDS = Object.freeze([
  { id: 1, question: "一向聴の分類において、面子が2つある形を総称して何という？", answer: "2面子型一向聴" },
  { id: 2, question: "一向聴の分類において、面子が3つある形を総称して何という？", answer: "3面子型一向聴" },
  { id: 3, question: "2面子型一向聴に含まれる2つの分類は？", answer: "余剰牌型、完全形" },
  { id: 4, question: "3面子型一向聴に含まれる3つの分類は？", answer: "ヘッドレス1型、ヘッドレス2型、くっつき" },
  { id: 5, question: "ヘッドレス1型の構成（面子とターツの数）は？", answer: "3面子 ＋ 1ターツ" },
  { id: 6, question: "ヘッドレス2型の構成（面子とターツの数）は？", answer: "3面子 ＋ 2ターツ" },
  { id: 7, question: "くっつき一向聴の構成は？", answer: "3面子 ＋ 1雀頭 ＋ 1孤立牌" },
  { id: 8, question: "講義における「連続形」の定義は何枚の形？", answer: "5枚" },
  { id: 9, question: "連続形の構成条件は何と何がくっついていること？", answer: "順子（シュンツ）とターツ" },
  { id: 10, question: "暗刻（アンコ）とターツがくっついている形は連続形と呼ぶ？", answer: "呼ばない（順子とターツの結合が条件）" },
  { id: 11, question: "エンスク（講義内）でのブロック数え方の絶対ルールは？", answer: "3枚あるなら必ず面子として数える" },
  { id: 12, question: "面子を正しく抜くことで、何の一向聴か判断できるようになる目的は？", answer: "自分の手牌価値を正しく認識するため" },
  { id: 13, question: "麻雀の筋（スジ）で「1-4-7」の呼び方は？", answer: "イースッチー" },
  { id: 14, question: "麻雀の筋で「2-5-8」の呼び方は？", answer: "リャンウーパー" },
  { id: 15, question: "麻雀の筋で「3-6-9」の呼び方は？", answer: "サブロクキュー" },
  { id: 16, question: "雀頭がない形の一向聴を何と呼ぶ？", answer: "ヘッドレス（1型・2型）" },
  { id: 17, question: "ヘッドレス2型で連続形がある場合、受け入れをどう表現する？", answer: "「左隣から右隣まで」と言える" },
  { id: 18, question: "くっつき一向聴で、孤立牌にくっつく範囲の原則は？", answer: "-2から+2（2つの隣から2つの隣まで）" },
  { id: 19, question: "くっつき一向聴で、テンパイ条件に含まれる特殊なケースは？", answer: "雀頭が暗刻になること" },
  { id: 20, question: "ヘッドレス1型で注意すべき「1つ飛ばしの牌」がある形は？", answer: "ターツスキップ（例：3・5・6から4を引く）" },
  { id: 21, question: "ヘッドレス1型で注意すべき「2・4・6」などの形は？", answer: "リャンカン形" },
  { id: 22, question: "ヘッドレス1型の注意点である「四角（シカク）」の3つの形は？", answer: "のべタン、ありメン、アンチョビ" },
  { id: 23, question: "「2・3・4・5」の形のように、雀頭候補が2つある単騎待ちを何という？", answer: "のべタン" },
  { id: 24, question: "面子の隣にその面子を構成する牌と同じ牌がある形を何という？", answer: "ありメン（例：3・4・5・5）" },
  { id: 25, question: "単騎待ちの牌に暗刻が隣接している形を何という？", answer: "アンチョビ（例：2・2・2・3）" },
  { id: 26, question: "筋が伸びる法則1「待ちから始まる順子がくっつくと」どうなる？", answer: "筋が伸びる（例：1待ちに123がつく→1-4待ち）" },
  { id: 27, question: "筋が伸びる法則2「単騎待ちの隣から始まる順子がくっつくと」どうなる？", answer: "筋が伸びる（例：2単騎に345がつく→2-5待ち）" },
  { id: 28, question: "筋が伸びる法則3「単騎待ちの近くに暗刻があると」どうなる？", answer: "待ち（受け入れ）が増える（アンチョビ形）" },
  { id: 29, question: "4枚同じ牌を持っていることを何という？", answer: "槓子（カンツ）" },
  { id: 30, question: "5枚連続している形（23456）は何面待ち？", answer: "三面張（1・4・7待ち）" },
  { id: 31, question: "5枚連続形は、どの形の一向聴と相性が良い？", answer: "ヘッドレス2型" },
  { id: 32, question: "完全形の定義は？", answer: "孤立牌がターツをフォローしている状態" },
  { id: 33, question: "完全形に必ず存在する2つのパターンのいずれかは？", answer: "2ヘッド または リャンカン" },
  { id: 34, question: "「離れリャンカン」とはどのような形？", answer: "カンチャンとカンチャンが1枚離れて繋がっている形" },
  { id: 35, question: "13種類あるとされる、1面子を構成しつつ受け入れを広げる形は？", answer: "6枚形" },
  { id: 36, question: "6枚形のうち、暗刻を含む形での判断ポイントは？", answer: "対子（トイツ）の場所に注目する" },
  { id: 37, question: "端に対子がある6枚形の受け入れ範囲は？", answer: "「端から対子の隣まで」" },
  { id: 38, question: "真ん中に雀頭がある6枚形の受け入れ範囲は？", answer: "「左隣から右隣まで」全部" },
  { id: 39, question: "ヘッドレス1型で「両面2筋」で答えられる形は？", answer: "リャンカン形、スキップ形" },
  { id: 40, question: "3面子型一向聴が2面子型より優れている点は？", answer: "圧倒的に受け入れが広く、テンパイしやすい" },
  { id: 41, question: "講義で「0.3秒で答えを出す」ために必要なことは？", answer: "脳のチャンク化（形として覚える）" },
  { id: 42, question: "なぜ自分の口から専門用語（筋の呼び名など）を出すべきか？", answer: "他者の解説を瞬時にリスニング・理解するため" },
  { id: 43, question: "初心者が陥りやすい、暗刻の数え方のミスは？", answer: "雀頭とターツに分けて数えてしまう（面子を崩す）" },
  { id: 44, question: "講義の最終目標は、何ができるようになること？", answer: "問題を見てすぐ何の一向聴か分類できること" },
  { id: 45, question: "リャンメン待ちとカンチャン待ちの両方の性質を持つ形は？", answer: "両面カンチャン形（例：34568）" },
  { id: 46, question: "3面子型で一番受け入れが広くなる分類はどれ？", answer: "ヘッドレス2型" },
  { id: 47, question: "手牌の価値を正しく判断できないとどのようなミスが起きる？", answer: "手作りや押し引きの判断（手牌価値の認識）を誤る" },
  { id: 48, question: "リャンシャンテン（二向聴）の時に意識すべきことは？", answer: "良い一向聴を目指して手組みすること" },
  { id: 49, question: "雀頭がない一向聴（ヘッドレス）のテンパイ条件は？", answer: "ターツが面子になる、または孤立牌が重なる" },
  { id: 50, question: "5枚の連続形（三面張）にスキップ牌がついた形を何という？", answer: "三面張スキップ形" },
]);

export function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

/**
 * @param {SessionMode} mode
 * @param {number[]} reviewCardIds
 * @param {() => number} random
 */
export function createSessionCards(mode, reviewCardIds = [], random = Math.random) {
  if (mode === "quick") return shuffled(FLASHCARDS, random).slice(0, 10);
  if (mode === "review") {
    const reviewSet = new Set(reviewCardIds);
    return shuffled(FLASHCARDS.filter((card) => reviewSet.has(card.id)), random);
  }
  return [...FLASHCARDS];
}

export function getRank(rate) {
  if (rate >= 90) return "S";
  if (rate >= 80) return "A";
  if (rate >= 65) return "B";
  if (rate >= 50) return "C";
  return "D";
}

export function updateReviewIds(reviewCardIds, cardId, rating) {
  const next = new Set(reviewCardIds);
  if (rating === "known") next.delete(cardId);
  if (rating === "again") next.add(cardId);
  return [...next].sort((a, b) => a - b);
}

export function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

export function readProgress(raw) {
  if (!raw) return { reviewCardIds: [], lastSession: null };
  try {
    const parsed = JSON.parse(raw);
    const validIds = Array.isArray(parsed.reviewCardIds)
      ? parsed.reviewCardIds.filter((id) => Number.isInteger(id) && id >= 1 && id <= 50)
      : [];
    return {
      reviewCardIds: [...new Set(validIds)].sort((a, b) => a - b),
      lastSession: parsed.lastSession && typeof parsed.lastSession === "object" ? parsed.lastSession : null,
    };
  } catch {
    return { reviewCardIds: [], lastSession: null };
  }
}
