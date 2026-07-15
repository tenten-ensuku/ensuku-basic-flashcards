export const APP_VERSION = 12;
export const STORAGE_KEY = "ensuku-basic-flashcards-v4";
export const LEGACY_STORAGE_KEY = "ensuku-basic-flashcards-v3";

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
  { id: 24, question: "2234ｍのような□×はなんという名称で呼ばれる形？", answer: "亜両面（例：3455ｍ、1123ｐ）" },
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
  { id: 50, question: "何を引けば聴牌する？\n1234ｍ245678ｐ発発発", answer: "牌姿\n1234ｍ245678ｐ発発発\n受け入れ\n14ｍ、258ｐ369ｐ" },
]);

/** @type {ReadonlyArray<Flashcard>} */
export const NEJIMAKI_FLASHCARDS = Object.freeze([
  { id: 1, question: "余剰牌型一向聴とはどのような状態？", answer: "2面子1雀頭2ターツに受け入れを増やしていない孤立牌が存在する形。" },
  { id: 2, question: "完全形一向聴とはどのような状態？", answer: "2面子1雀頭があり、2ターツのうち1つのターツをもう1枚の牌がフォローしている状態。" },
  { id: 3, question: "ヘッドレス1型の定義は？", answer: "3面子（雀頭なし）があり、ターツが1つある状態。" },
  { id: 4, question: "ヘッドレス1型のテンパイ条件は？", answer: "「ターツが面子（四角）になる」または「孤立牌が対子（丸）になる」こと。" },
  { id: 5, question: "ヘッドレス2型の定義は？", answer: "3面子（雀頭なし）があり、ターツが2つある状態。" },
  { id: 6, question: "ヘッドレス2型のテンパイ条件は？", answer: "どちらかのターツが面子（四角）か頭（丸）になること。" },
  { id: 7, question: "ヘッドレス2型の大きな特徴は？", answer: "受け入れを「何から何まで」と範囲で言えることが多い点。" },
  { id: 8, question: "くっつき一向聴の定義は？", answer: "3面子1雀頭があり、孤立牌が2枚ある状態。" },
  { id: 9, question: "くっつき一向聴のテンパイ条件は？", answer: "「孤立牌に牌がくっついてターツができる」または「雀頭が暗刻になる」こと。" },
  { id: 10, question: "「ヘッドレス」と「くっつき」の共通点は？", answer: "どちらも3面子完成している一向聴であること。" },
  { id: 11, question: "「筋のびーるの法則」とは何に関する法則？", answer: "複雑な形で待ちが増える（多面張になる）仕組みを説明する法則。" },
  { id: 12, question: "筋のびーるの法則1「待ちを端に含む順子がくっつく」とどうなる？", answer: "待ちがその牌の筋まで伸びる（例：1-4待ちに456がくっつくと1-4-7待ちになる）。" },
  { id: 13, question: "筋のびーるの法則2「単騎待ちに隣接する順子がくっつく」とどうなる？", answer: "待ちが筋まで伸びて「のべタン」の形になる（例：5単騎に678がくっつくと5-8待ちになる）。" },
  { id: 14, question: "待ちが増える法則3つ目はなんだろう？", answer: "「単騎待ちの近くに暗刻があるとアンチョビ形となって待ちが増える」\n（例　3335ｐ➡45ｐ待ち　1222ｍ➡13ｍ待ち　2223ｍ➡143ｍ）" },
  { id: 15, question: "暗刻に少し離れて牌がくっついている形（333と5など）の通称は？", answer: "アンチョビ（暗刻にちょびっとくっついているから）。" },
  { id: 16, question: "ヘッドレス1型で受け入れが増える「要注意形」を3つ挙げよ。", answer: "ターツスキップ、リャンカン、□×" },
  { id: 17, question: "「ターツスキップ」とはどのような形？", answer: "ターツの1つ飛ばしの牌（スキップ牌）を持っている形（例：56と8）。" },
  { id: 18, question: "ターツスキップ（例：245）がある時の受け入れをスマートに言うと？（ヘッドレス1型時）", answer: "両面2筋（サブロー・リャンウー）のように言う。" },
  { id: 19, question: "スキップ牌という画期的なワードを生み出したのは何期生の誰？", answer: "5期生みょもるふぁさん" },
  { id: 20, question: "「□×」とはどのような状態？", answer: "面子（四角）と孤立牌（バツ）がくっついている状態。" },
  { id: 21, question: "四角バツの代表的な3つの形は？", answer: "のべタン、亜両面、アンチョビ。" },
  { id: 22, question: "「亜両面」とはどのような形？", answer: "順子にその端の牌が重なっている形（例：4566）。\n亜＝準ずる、劣るの意味。　単純な両面よりも受け入れ2枚を使用している為、待ちとしては単純両面にやや劣ることから名付けられた。" },
  { id: 23, question: "亜両面（4566ｍ）の受け入れが伸びる理由は？", answer: "6ｍ単騎受けだけでなく、筋のびーるの法則（1番）により3の受けも増えるため。" },
  { id: 24, question: "ヘッドレス1型で「7枚形」と呼ばれる形はどのような形か説明し、エンスクドリルで何種類とされているか答えよ。", answer: "2面子（6枚）に孤立牌1枚がくっついた、合計7枚の形。□×に更に□がくっついたもの。19種類。" },
  { id: 25, question: "アンチョビ形の名付け親は何期生のだれ？", answer: "6期生ずぴたーさん" },
  { id: 26, question: "ヘッドレス2型において「連続形」とはどのような形？", answer: "順子（四角）とターツ（三角）がくっついた5枚の形。" },
  { id: 27, question: "ヘッドレス2型に連続形があると講師（てんてんさん）はどう表現する？", answer: "「めっちゃいい形」としてハートマークを描く。" },
  { id: 28, question: "「隙間のない連続形」の受け入れ範囲は？", answer: "左隣から右隣まで全部。" },
  { id: 29, question: "23456（隙間のない連続形）の受け入れは？", answer: "1から7まで（イーピンからチーピンまで）。" },
  { id: 30, question: "「隙間のある連続形」とはどのような形？", answer: "順子とターツがくっついているが、カンチャン部分など持っていない牌がある形。" },
  { id: 31, question: "隙間のある連続形の受け入れはどう増える？", answer: "本来のターツの受け入れに加え、筋が1種類増える。" },
  { id: 32, question: "24456ｍ（隙間のある連続形）の受け入れは？", answer: "本来の234ｍの受け入れに筋の7が増えて2347ｍとなる。" },
  { id: 33, question: "ヘッドレス2型は、なぜ1型よりも簡単と言われる？", answer: "連続形があるかないかだけだから。受け入れも隙間のある連続形以外は全て何から何までと言える為。" },
  { id: 34, question: "孤立牌に牌がくっついてターツ（三角）になるのは、何個隣まで？", answer: "2個隣まで。" },
  { id: 35, question: "1や9の孤立牌にくっつく牌（対子含む）は何種類？", answer: "3種類（1なら1・2・3）。" },
  { id: 36, question: "3〜7の孤立牌にくっつく牌は何種類？", answer: "5種類（例：4なら2・3・4・5・6）。" },
  { id: 37, question: "3〜7の孤立牌の通称は？", answer: "強孤立牌（きょうこりつはい）。" },
  { id: 38, question: "強孤立牌の中で、最も強いとされる牌とその理由は？", answer: "3と7。端っこに近い良形（両面や端のカンチャン）を作りやすいため。" },
  { id: 39, question: "強孤立牌（3〜7）の中で、最も弱いとされる牌とその理由は？", answer: "5。ど真ん中なので、できる待ちも真ん中に寄りやすく上がりづらいため。" },
  { id: 40, question: "タンヤオが確定しそうな場合、3よりも優先すべき孤立牌は？", answer: "4や5（1を引いて役が消えるリスクがないため）。" },
  { id: 41, question: "くっつき業界のエース「中膨れ（なかぶくれ）」とはどんな形？", answer: "4556のように、真ん中が膨らんでいる4枚の形。" },
  { id: 42, question: "中膨れがエースである理由を二つ言って。", answer: "両面待ちになる受け入れが圧倒的に多いため（4種類で両面になる）。一盃口チャンスもある。" },
  { id: 43, question: "くっつきのもう一人のエース「4連形」の強みは？", answer: "非常に広い範囲（最大8種類）でくっつき、三面張待ちにもなり得る。" },
  { id: 44, question: "重要知識1：雀頭（対子）のすぐ隣の孤立牌を残すと、受け入れは何枚ロス？", answer: "4枚ロス。" },
  { id: 45, question: "雀頭（11ｍ）のそばの牌（2ｍや3ｍ）のくっつきが4枚ロスとなる理由は？", answer: "自分で雀頭として2枚使っている牌（1）が、くっつき牌（2）の受け入れと重複してしまうため。" },
  { id: 46, question: "重要知識2：両面対子（例：344）と非常に相性が良い形は？", answer: "□×（4連形、亜両面、アンチョビ等）。" },
  { id: 47, question: "4連形と両面対子をセットで残すべき理由は？", answer: "枚数は減るが、両面テンパイできる確率が大幅に上がるため。" },
  { id: 48, question: "重要知識3：中膨れ（例：4556）と両面対子（例：344）の相性は？", answer: "相性が悪い。" },
  { id: 49, question: "中膨れと両面対子の相性が悪い理由は？", answer: "両面対子が両面として機能する受け入れが極端に少なくせっかくの両面対子が活かせない為。" },
  { id: 50, question: "端っこ（1234）の4連形は強い？", answer: "強くない。くっつきとしての強さは単独の強孤立牌程度。ただし、両面対子とは相性が良い。" },
]);

export const LESSONS = Object.freeze({
  tenten: Object.freeze({ id: "tenten", label: "7/14　てんてん授業", cards: FLASHCARDS }),
  nejimaki: Object.freeze({ id: "nejimaki", label: "7/2　ねじまき鳥先生", cards: NEJIMAKI_FLASHCARDS }),
});

/**
 * @param {keyof typeof LESSONS} lessonId
 * @param {SessionMode} mode
 * @param {number[]} reviewCardIds
 * @param {ReadonlyArray<Flashcard>} cards
 */
export function createSessionCards(lessonId, mode, reviewCardIds = [], cards) {
  const lesson = LESSONS[lessonId];
  if (!lesson) throw new RangeError(`Unknown lesson: ${lessonId}`);
  const sourceCards = cards ?? lesson.cards;
  if (mode === "all") return [...sourceCards];
  if (mode === "review") {
    const reviewSet = new Set(reviewCardIds);
    return sourceCards.filter((card) => reviewSet.has(card.id));
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
  const empty = { reviewCardIdsByLesson: { tenten: [], nejimaki: [] }, lastSession: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    const sanitize = (ids, length) => [...new Set(
      Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id) && id >= 1 && id <= length) : [],
    )].sort((a, b) => a - b);
    const legacyTentenIds = parsed.reviewCardIds;
    return {
      reviewCardIdsByLesson: {
        tenten: sanitize(parsed.reviewCardIdsByLesson?.tenten ?? legacyTentenIds, FLASHCARDS.length),
        nejimaki: sanitize(parsed.reviewCardIdsByLesson?.nejimaki, NEJIMAKI_FLASHCARDS.length),
      },
      lastSession: parsed.lastSession && typeof parsed.lastSession === "object" ? parsed.lastSession : null,
    };
  } catch {
    return empty;
  }
}
