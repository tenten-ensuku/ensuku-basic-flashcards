export const APP_VERSION = 4;
export const STORAGE_KEY = "ensuku-basic-flashcards-v3";

/** @typedef {{ id: number, question: string, answer: string }} Flashcard */
/** @typedef {"all" | "review"} SessionMode */

/** @type {ReadonlyArray<Flashcard>} */
export const FLASHCARDS = Object.freeze([
  { id: 1, question: "一向聴の分類において、面子が2つある形を総称して何という？", answer: "2面子型一向聴" },
  { id: 2, question: "一向聴の分類において、面子が3つある形を総称して何という？", answer: "3面子型一向聴" },
  { id: 3, question: "2面子型一向聴に含まれる2つの分類は？", answer: "余剰牌型、完全形" },
  { id: 4, question: "3面子型一向聴に含まれる3つの分類は？", answer: "ヘッドレス1型、ヘッドレス2型、くっつき" },
  { id: 5, question: "ヘッドレス1型の構成（面子とターツの数）は？", answer: "3面子 ＋ 1ターツ" },
  { id: 6, question: "ヘッドレス2型の構成（面子とターツの数）は？", answer: "3面子 ＋ 2ターツ" },
  { id: 7, question: "くっつき一向聴の構成は？", answer: "3面子 ＋ 1雀頭" },
  { id: 8, question: "ヘッドレス2型と相性が良いのは？", answer: "連続形" },
  { id: 9, question: "連続形の定義は？", answer: "順子とターツがくっついた5枚形。" },
  { id: 10, question: "暗刻（アンコ）とターツがくっついている形は連続形と呼ぶ？", answer: "呼ばない（順子とターツの結合が条件）" },
  { id: 11, question: "エンスク（講義内）でのブロック数え方の絶対ルールは？", answer: "3枚あるなら必ず面子として抜き出して１ブロック数える。重複カウントは認めない。" },
  { id: 12, question: "麻雀の筋（スジ）で「1-4-7」の呼び方は？", answer: "イースーチー" },
  { id: 13, question: "麻雀の筋で「2-5-8」の呼び方は？", answer: "リャンウーパー" },
  { id: 14, question: "麻雀の筋で「3-6-9」の呼び方は？", answer: "サブローキュー" },
  { id: 15, question: "雀頭がない形の一向聴を何と呼ぶ？", answer: "ヘッドレス（1型・2型）" },
  { id: 16, question: "ヘッドレス2型で連続形がある場合、受け入れをどう表現する？", answer: "「左隣から右隣まで」と言える" },
  { id: 17, question: "くっつき一向聴で、孤立牌にくっつく範囲の原則は？", answer: "-2から+2（2つの隣から2つの隣まで）" },
  { id: 18, question: "くっつき一向聴のテンパイ条件は孤立牌にくっついてターツ化する事と？", answer: "雀頭が暗刻になること" },
  { id: 19, question: "ヘッドレス1型で注意すべき「ターツの1つ飛ばしの牌」がある形は？", answer: "ターツスキップ形" },
  { id: 20, question: "ヘッドレス1型の受け入れを答える際に注意すべき三種の形は？", answer: "□×、ターツスキップ形、リャンカン形" },
  { id: 21, question: "ヘッドレス1型の受け入れで要チェックな「□×」は何があった？", answer: "のべタン、亜両面、アンチョビ" },
  { id: 22, question: "単騎待ちとは？", answer: "雀頭待ちのこと。待ちが1種という意味では無いので要注意。ターツ待ち（辺張やカンチャン）は単騎待ちでは無い。ノベタンは2面待ちだが単騎待ちだ。" },
  { id: 23, question: "「2345ｍ」の形のように、雀頭待ち候補が2つある単騎待ちを何という？", answer: "のべたん" },
  { id: 24, question: "2234ｍのような□×はなんと", answer: "亜両面（例：3455ｍ、1123ｐ）" },
  { id: 25, question: "単騎待ちの牌に暗刻が隣接している形を何という？", answer: "アンチョビ形（例：3334ｐ　1333ｓ）" },
  { id: 26, question: "面子がくっついて待ちが増える法則①を答えよ。簡単な例も1つ作って。", answer: "待ちから始まる順子がくっつくと筋のびーる。\n例①　23ｍという14ｍ待ちに4mから始まる順子456ｍがくっつくと23456ｍとなり147ｍ待ちとなる。（筋7ｍが増えた！）\n\n例②　1ｍ単騎待ちに1ｍから始まる順子123ｍがくっつくと1123ｍ（亜両面）となって14ｍ待ちとなる。（筋4ｍが増えた！）" },
  { id: 27, question: "面子がくっついて待ちが増える法則②を答えよ。簡単な例も1つ作って。", answer: "単騎待ちの隣から始まる順子がくっつくと筋のびーる。\n\n例①　2ｍ単騎待ちに345ｍがくっつくと、2345ｍ（ノベタン）となって25ｍ待ちとなる。（筋が増えた！）\n例②　2345ｐ（25ｐノベタン待ち）に678ｐがくっつくと、8ｐも待ちになる。（筋8ｐが増えた！）" },
  { id: 28, question: "面子がくっついて待ちが増える法則③を答えよ。簡単な例も1つ作って。", answer: "単騎待ちの近くに暗刻がくっつくと、アンチョビ形となって待ちが増える。\n例　4ｐ単騎待ちに555ｐがくっつくと4555ｐとなって36ｐ4ｐ待ちとなる。（36ｐが増えた！）" },
  { id: 29, question: "4枚同じ牌を持っていることを何という？", answer: "槓子（カンツ）" },
  { id: 30, question: "23456ｍは何待ち？", answer: "147ｍ待ち" },
  { id: 31, question: "完全形一向聴の定義は？", answer: "孤立牌がターツをフォローしている2面子型一向聴。" },
  { id: 32, question: "完全形一向聴には必ず、何か何がある？", answer: "2ヘッド または リャンカン" },
  { id: 33, question: "6枚形「離れリャンカン」とはどのような形？例を2種作れ。", answer: "134568ｍ\n245679ｐ" },
  { id: 34, question: "1面子を構成しつつ2面子作る為のフォロー牌がついている形（□△×）をなんと呼ぶ？それは何種類ある？", answer: "6枚形、13種類" },
  { id: 35, question: "6枚形のうち、暗刻を含む形を瞬間的に攻略する裏技があったが、何の位置に注目すればいい？", answer: "対子（トイツ）の場所に注目する" },
  { id: 36, question: "端に対子がある暗刻含み6枚形の受け入れ範囲は？例も一つ作れ。", answer: "「端から対子の隣まで」\n例　334445ｍ→受け入れ2ｍ～5ｍ" },
  { id: 37, question: "真ん中に対子がある暗刻含み6枚形の受け入れ範囲は？例も一つ作れ。", answer: "「左隣から右隣まで」全部\n例　333445ｍ→受け入れは2ｍ～6ｍ" },
  { id: 38, question: "対子が無い暗刻含み6枚形の受け入れは？例も一つ作れ。", answer: "両端2枚のターツ待ち。\n例：233345ｍ→受け入れ14ｍと36ｍ　\n　　345557ｐ→受け入れは25ｐとカン6ｐ" },
  { id: 39, question: "ヘッドレス1型の際、受け入れを「両面2筋」で答えられる形は？", answer: "リャンカン形、スキップ形" },
  { id: 40, question: "3面子型一向聴が2面子型より優れている点は？", answer: "圧倒的に受け入れが広く、テンパイしやすい" },
  { id: 41, question: "なぜ自分の口から専門用語（筋の呼び名など）を出すべきか？", answer: "他者の解説を瞬時にリスニング・理解するため" },
  { id: 42, question: "リャンメン待ちとカンチャン待ちの両方の受け入れを持つ6枚形の名称は？例も1つ作れ。", answer: "両面カンチャン形（例：344568ｍ　245667ｐ　　134556ｓ）" },
  { id: 43, question: "最強の受け入れの一向聴はなに？", answer: "くっつきの一向聴" },
  { id: 44, question: "手牌の価値を正しく判断できないとどのようなミスが起きる？", answer: "手作りや押し引きの判断（手牌価値の認識）を誤る" },
  { id: 45, question: "二面子完成したら？", answer: "一向聴かチェック！！一向聴じゃない場合には何故一向聴じゃないのかを考えると、残す牌が定まる。（大体はターツ不足なので、くっつき2向聴として見られる）　　　　って、授業で伝え忘れた気がしますがｗ" },
  { id: 46, question: "ヘッドレス1型の聴牌条件は何？", answer: "ターツが面子になるor孤立牌が重なって頭になる" },
  { id: 47, question: "5枚の連続形（三面張）にスキップ牌がついた形を何という?", answer: "三面張スキップ形" },
  { id: 48, question: "ヘッドレス1型の際の注意すべき形、両面スキップ形は受け入れをどのように答えられる？", answer: "両面2筋で格好良く！" },
  { id: 49, question: "ヘッドレス1型の際に3面張スキップ形は、受け入れをどのように答えられる？", answer: "三面張2筋で格好良く！\n例、134567ｍ→受け入れ147ｍ258ｍ　と答えられる。（ヘッドレス1型でのみなので注意）" },
  { id: 50, question: "何を引けば聴牌する？\n1234ｍ245678ｐ發發發", answer: "牌姿\n1234ｍ245678ｐ發發發\n受け入れ\n14ｍ、258ｐ369ｐ" },
]);

/**
 * @param {SessionMode} mode
 * @param {number[]} reviewCardIds
 */
export function createSessionCards(mode, reviewCardIds = []) {
  if (mode === "all") return [...FLASHCARDS];
  if (mode === "review") {
    const reviewSet = new Set(reviewCardIds);
    return FLASHCARDS.filter((card) => reviewSet.has(card.id));
  }
  throw new RangeError(`Unknown session mode: ${mode}`);
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
      ? parsed.reviewCardIds.filter((id) => Number.isInteger(id) && id >= 1 && id <= FLASHCARDS.length)
      : [];
    return {
      reviewCardIds: [...new Set(validIds)].sort((a, b) => a - b),
      lastSession: parsed.lastSession && typeof parsed.lastSession === "object" ? parsed.lastSession : null,
    };
  } catch {
    return { reviewCardIds: [], lastSession: null };
  }
}
