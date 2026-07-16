export const QUIZ_LESSON = Object.freeze({
  id: "basic-order-2026-07-16",
  label: "7/16　ねじまき鳥先生",
  title: "基本序列マスタークイズ",
  videoUrl: "https://youtu.be/NE1UHrZkg6g",
});

export const QUIZ_STORAGE_KEY = "ensuku-basic-order-quiz-v1";

/**
 * @typedef {{
 *   id: number,
 *   chapter: string,
 *   question: string,
 *   options: readonly string[],
 *   correctIndex: number,
 *   explanation: string,
 * }} QuizQuestion
 */

/** @type {ReadonlyArray<QuizQuestion>} */
export const BASIC_ORDER_QUIZ = Object.freeze([
  {
    id: 1,
    chapter: "第1章　基本序列と孤立牌の評価",
    question: "孤立牌の最も基本的な切り順（弱い順）として正しいものは？",
    options: [
      "孤立1・9 ＜ オタ風 ＜ 役牌 ＜ 2・8 ＜ 3〜7",
      "オタ風 ＜ 孤立1・9 ＜ 役牌 ＜ 2・8 ＜ 3〜7",
      "オタ風 ＜ 役牌 ＜ 孤立1・9 ＜ 2・8 ＜ 3〜7",
      "役牌 ＜ オタ風 ＜ 孤立1・9 ＜ 2・8 ＜ 3〜7",
    ],
    correctIndex: 1,
    explanation: "基本序列は「孤立オタ風 ＜ 孤立1・9 ＜ 孤立役牌 ＜ 孤立2・8 ＜ 孤立3〜7」です。",
  },
  {
    id: 2,
    chapter: "第1章　基本序列と孤立牌の評価",
    question: "孤立3〜7が「強孤立牌」と呼ばれる理由は？",
    options: [
      "1種類引くだけで面子が完成するから",
      "2種類（両側）の牌で両面待ちが作れるから",
      "鳴きやすい牌だから",
      "安全度が非常に高いから",
    ],
    correctIndex: 1,
    explanation: "3〜7は、例えば「4」なら3と5の2種類で両面が作れますが、2・8は1種類、1・9は作れません。",
  },
  {
    id: 3,
    chapter: "第1章　基本序列と孤立牌の評価",
    question: "孤立牌の評価において「最強の王」とされ、聴牌まで切ってはいけないのは？",
    options: ["役牌の対子", "ドラの3〜7", "面子（特に単独暗刻）", "両面ターツ"],
    correctIndex: 2,
    explanation: "面子は基本序列界で最強の王です。特に単独暗刻は聴牌まで切ってはいけません。",
  },
  {
    id: 4,
    chapter: "第1章　基本序列と孤立牌の評価",
    question: "特殊な形「1345」の「1」の価値は、どの牌と同等以上とされる？",
    options: ["孤立3〜7", "孤立2・8", "役牌", "オタ風"],
    correctIndex: 1,
    explanation: "1345の1は、2を引いた時に3-6の両面ができるため、孤立2・8と同等以上の価値があります。",
  },
  {
    id: 5,
    chapter: "第1章　基本序列と孤立牌の評価",
    question: "孤立牌が「ドラ」そのものや「ドラ受け」である場合、序列はどうなる？",
    options: ["変わらない", "1ランク以上ダウンする", "1ランク以上アップする", "最優先で切り飛ばす"],
    correctIndex: 2,
    explanation: "ドラやドラ受けの孤立牌は、序列の格付けが1ランク以上アップします。",
  },
  {
    id: 6,
    chapter: "第2章　字牌（オタ風・役牌）の切り順",
    question: "自分から見て「上家（かみちゃ）」のオタ風を最後に残すべき理由は？",
    options: [
      "上家が一番強そうだから",
      "上家に鳴かれた時、他2人のツモを飛ばして自分の番になるから",
      "自分がチーしやすいから",
      "安全牌として機能しないから",
    ],
    correctIndex: 1,
    explanation: "上家に鳴かれると自分にすぐ番が回るため、敵のツモを飛ばせるメリットがあります。",
  },
  {
    id: 7,
    chapter: "第2章　字牌（オタ風・役牌）の切り順",
    question: "役牌を切り始める際、共通する大原則は？",
    options: ["重なるまでギリギリまで持つ", "リーチがかかるまで持っておく", "早く切れば切るほど鳴かれにくい", "1枚切れたら切る"],
    correctIndex: 2,
    explanation: "役牌は早く切れば切るほど他家に鳴かれにくいため、鳴かれたくないものから先に処理します。",
  },
  {
    id: 8,
    chapter: "第2章　字牌（オタ風・役牌）の切り順",
    question: "役牌内での切り順（優先順位）として正しいのは？",
    options: [
      "自風 → 三元牌 → 他家連風",
      "三元牌 → 自風 → 他家連風",
      "他家連風 → 三元牌 → 自風",
      "自風 → 他家連風 → 三元牌",
    ],
    correctIndex: 2,
    explanation: "鳴かれて痛い「他家連風（ダブ東など）」を先に切り、自分の役にだけなる「自風」を最後に残します。",
  },
  {
    id: 9,
    chapter: "第2章　字牌（オタ風・役牌）の切り順",
    question: "自分が親の時（東1局）、東・白・西の切り順はどうなる？（西はオタ風）",
    options: ["西 → 白 → 東", "東 → 白 → 西", "白 → 西 → 東", "西 → 東 → 白"],
    correctIndex: 0,
    explanation: "基本序列（オタ風＜役牌）に従い、さらに役牌内では自連風（ダブ東）を最後に残します。",
  },
  {
    id: 10,
    chapter: "第3章　序列が逆転する特別なケース",
    question: "三色同順や一気通貫の種が「何種類以上」ある時、役牌より1・9を優先する？",
    options: ["4種類", "5種類", "6種類", "7種類"],
    correctIndex: 2,
    explanation: "手役の種が6種類以上ある場合は、役牌を先に切り飛ばして手役を追います。",
  },
  {
    id: 11,
    chapter: "第3章　序列が逆転する特別なケース",
    question: "「先制リーチが打てそう」と判断する基準（1面子の時）は？",
    options: ["1両面ターツがある", "2両面ターツがある", "3両面ターツがある", "4両面ターツがある"],
    correctIndex: 2,
    explanation: "1面子＋3両面ターツがある時は、先制リーチの可能性が高い好形と判断します。",
  },
  {
    id: 12,
    chapter: "第3章　序列が逆転する特別なケース",
    question: "通常は役牌を先に切るが、「孤立2・8」を先に切るべき状況は？",
    options: [
      "ドラが1枚もない時",
      "タンヤオもリーチも見えない「重たい手」の時",
      "自分がトップ目の時",
      "下家が染め手をしている時",
    ],
    correctIndex: 1,
    explanation: "0面子2愚形以上の重たい手では、役牌を重ねて鳴くことが唯一の上がり筋になるためです。",
  },
  {
    id: 13,
    chapter: "第3章　序列が逆転する特別なケース",
    question: "ペンチャンターツよりも「超強孤立牌（3〜7）」を残すべきケースは？",
    options: ["常時", "3〜7がドラの時", "3〜7が4連形や中膨れの時", "BとCの両方"],
    correctIndex: 3,
    explanation: "ドラ、4連形、中膨れの強孤立牌は「超強孤立牌」となり、ペンチャンより価値が高いです。",
  },
  {
    id: 14,
    chapter: "第4章　一手先フォロー牌と弱2ブロック",
    question: "「一手先フォロー牌」の正しい評価順位は？",
    options: [
      "孤立1・9 ＜ 一手先フォロー牌 ＜ 孤立2・8",
      "孤立2・8 ＜ 一手先フォロー牌 ＜ 孤立3〜7",
      "孤立3〜7 ＜ 一手先フォロー牌 ＜ ターツ",
      "孤立役牌 ＜ 一手先フォロー牌 ＜ 孤立2・8",
    ],
    correctIndex: 1,
    explanation: "2種以上の有効牌でフォロー牌（二面受け）に進化するため、孤立2・8より強いです。",
  },
  {
    id: 15,
    chapter: "第4章　一手先フォロー牌と弱2ブロック",
    question: "一手先フォロー牌の価値が「劇的に下がる」のはいつ？",
    options: ["配牌時", "二向聴（リャンシャンテン）", "一向聴（イーシャンテン）", "聴牌（テンパイ）"],
    correctIndex: 2,
    explanation: "一向聴では引いても聴牌するだけで、待ちを選べる程度のメリットしかなくなるからです。",
  },
  {
    id: 16,
    chapter: "第4章　一手先フォロー牌と弱2ブロック",
    question: "「弱2ブロック」の定義として正しいものは？",
    options: [
      "鳴いても役がつかない2ブロック",
      "1ブロックに整理しても、裏目を引いた際に面子が完成する形",
      "カンチャン待ちしかないブロック",
      "ドラを含まない2ブロック",
    ],
    correctIndex: 1,
    explanation: "カンチャン＋対子（1344）のように、1を捨てて3を引いても44で面子になる形です。",
  },
  {
    id: 17,
    chapter: "第4章　一手先フォロー牌と弱2ブロック",
    question: "弱2ブロックを整理してでも優先的に残すべき牌は？",
    options: ["孤立1・9", "オタ風", "強孤立牌（3〜7）", "役牌"],
    correctIndex: 2,
    explanation: "弱2ブロックは強孤立牌（3〜7）よりも価値が低いため、3〜7を残して整理します。",
  },
  {
    id: 18,
    chapter: "第5章　形による強弱（実践編）",
    question: "孤立牌は「何」に近づくほど強くなる？",
    options: ["刻子（コーツ）", "順子（シュンツ）", "ターツ", "雀頭（ジャントウ）"],
    correctIndex: 1,
    explanation: "階段状に並んでいる牌（順子）が近くにあるほど、好形を作りやすくなり強化されます。",
  },
  {
    id: 19,
    chapter: "第5章　形による強弱（実践編）",
    question: "逆に、孤立牌は「何」に近づくほど弱くなる？",
    options: ["刻子（コーツ）", "順子（シュンツ）", "ターツ", "雀頭（ジャントウ）"],
    correctIndex: 2,
    explanation: "近くにターツがあると有効牌が被り（二度受け）、価値が下がります。",
  },
  {
    id: 20,
    chapter: "第5章　形による強弱（実践編）",
    question: "「134」の「1」は、孤立の1・9と比べてどう評価される？",
    options: ["弱い（そばにターツがあるから）", "強い（例外的に1手で4連形になれるから）", "同じ", "状況による"],
    correctIndex: 1,
    explanation: "134や124の1は、例外的に孤立1よりも強い「フォロー牌」のような扱いとなります。",
  },
  {
    id: 21,
    chapter: "第6章　リーチ判断とブロック理論",
    question: "5ブロックを作るための手順書であるこの序列に従うと、どんなメリットがある？",
    options: [
      "常に高い打点で上がれる",
      "5ブロック完成まで「世界最強」と同じ打牌が打てる",
      "相手の当たり牌が100%わかる",
      "鳴き判断が完璧になる",
    ],
    correctIndex: 1,
    explanation: "序盤の孤立牌比較で8割以上の正解率を出せるようになり、AIやプロレベルの打牌が可能になります。",
  },
  {
    id: 22,
    chapter: "第6章　リーチ判断とブロック理論",
    question: "親の先制リーチについて、正しい考え方は？",
    options: ["待ちが良い時だけ打つ", "愚形（待ちが悪い）ならダマにする", "待ちが悪くても基本的には即リーチ", "ドラがある時だけ打つ"],
    correctIndex: 2,
    explanation: "親の先制は打点も高く他家への威圧感も強いため、愚形でも即リーチが推奨されます。",
  },
  {
    id: 23,
    chapter: "第6章　リーチ判断とブロック理論",
    question: "5ブロックが確定している（足りている）時の孤立牌の処理は？",
    options: [
      "序列の高い方から切る",
      "安全度の高い牌を残し、放銃リスクのある危険な牌から切る",
      "ドラに近い方から切る",
      "適当で良い",
    ],
    correctIndex: 1,
    explanation: "ブロックが足りているなら、もう受け入れを増やす必要がないため、守備重視の切り順になります。",
  },
  {
    id: 24,
    chapter: "第6章　リーチ判断とブロック理論",
    question: "「向聴（シャンテン）中毒者」がやりがちなミスは？",
    options: ["役牌をすぐに切ってしまう", "弱2ブロックを愚直に受けて一向聴に取ってしまう", "リーチをかけない", "5ブロックを作らない"],
    correctIndex: 1,
    explanation: "弱2ブロックをそのまま持つと良形率や打点が下がるため、整理して強孤立を残すべきです。",
  },
  {
    id: 25,
    chapter: "第7章　特殊な形と用語の定義",
    question: "端にかかった4連形（1234など）の扱いは？",
    options: ["超強孤立牌", "ただの強孤立牌（3〜7と同等）", "役牌より弱い", "最強の形"],
    correctIndex: 1,
    explanation: "5を含まない端の4連形は、強力な多面待ち変化が少ないため、通常の強孤立扱いです。",
  },
  {
    id: 26,
    chapter: "第7章　特殊な形と用語の定義",
    question: "「2468」や「1357」の形の評価は？",
    options: ["孤立2・8と同じ", "3〜7の強孤立牌とほぼ同等", "役牌より弱い", "面子と同じ"],
    correctIndex: 1,
    explanation: "2468 ≒ 3〜7の強孤立牌という認識で問題ありません。",
  },
  {
    id: 27,
    chapter: "第7章　特殊な形と用語の定義",
    question: "下記の中で「最弱2ブロック」とされ、役牌よりも先に切るべき形は？",
    options: ["1344", "1224", "3456", "1357"],
    correctIndex: 1,
    explanation: "1224は弱2ブロックの中でも突出して弱く、孤立2・8や役牌よりも先に切ります。",
  },
  {
    id: 28,
    chapter: "第7章　特殊な形と用語の定義",
    question: "「中膨れ（3445など）」を引いた時のメリットは？",
    options: ["対子が作りやすい", "安全度が高い", "3や6を引いた時に強力な多面待ちになる", "タンヤオが確定する"],
    correctIndex: 2,
    explanation: "中膨れは良形ターツを作りやすく、非常に価値の高い形です。",
  },
  {
    id: 29,
    chapter: "第7章　特殊な形と用語の定義",
    question: "孤立牌の価値比較ドリルにおいて、練習すべき最も重要なポイントは？",
    options: ["役満の作り方", "序盤の孤立牌の強弱を瞬時に見分けること", "相手の捨て牌の読み方", "点数計算"],
    correctIndex: 1,
    explanation: "孤立牌比較シートなどで反復練習し、定着させることが推奨されています。",
  },
  {
    id: 30,
    chapter: "第7章　特殊な形と用語の定義",
    question: "ホンイツ（混一色）に向かう際、染め色＋字牌で何枚あれば「強行」して良いとされる？",
    options: ["7枚", "8枚", "9枚以上", "13枚"],
    correctIndex: 2,
    explanation: "手なりでゴミ手になりそうな時でも、染め色の牌と字牌が9〜10枚あれば混一色を狙う価値があります。",
  },
]);

export function mergeQuizOverrides(baseQuestions, overrides, quizId = QUIZ_LESSON.id) {
  const questions = baseQuestions.map((question) => ({ ...question, options: [...question.options] }));
  for (const override of overrides) {
    if (override.quizId !== quizId) continue;
    const index = questions.findIndex((question) => question.id === override.id);
    if (index < 0 || !override.question || !override.explanation || override.options?.length !== 4) continue;
    questions[index] = {
      ...questions[index],
      question: override.question,
      options: [...override.options],
      correctIndex: override.correctIndex,
      explanation: override.explanation,
    };
  }
  return questions;
}

export function choiceLabel(index) {
  return String.fromCharCode(65 + index);
}

export function scoreQuiz(answers, total) {
  const correct = answers.filter((answer) => answer.correct).length;
  const count = Math.max(0, total);
  return {
    correct,
    wrong: Math.max(0, count - correct),
    rate: count ? Math.round((correct / count) * 100) : 0,
  };
}

export function readQuizProgress(raw) {
  const empty = { reviewQuestionIds: [], session: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    const sanitizeIds = (ids) => [...new Set(
      Array.isArray(ids)
        ? ids.filter((id) => Number.isInteger(id) && id >= 1 && id <= BASIC_ORDER_QUIZ.length)
        : [],
    )].sort((a, b) => a - b);
    const reviewQuestionIds = sanitizeIds(parsed.reviewQuestionIds);
    if (!parsed.session || typeof parsed.session !== "object") {
      return { reviewQuestionIds, session: null };
    }
    const questionIds = sanitizeIds(parsed.session.questionIds);
    if (!questionIds.length) return { reviewQuestionIds, session: null };
    const questionIdSet = new Set(questionIds);
    const answers = Array.isArray(parsed.session.answers)
      ? parsed.session.answers.flatMap((answer) => {
        const questionId = answer?.questionId;
        const selectedIndex = answer?.selectedIndex;
        return questionIdSet.has(questionId)
          && Number.isInteger(selectedIndex)
          && selectedIndex >= 0
          && selectedIndex <= 3
          ? [{ questionId, selectedIndex }]
          : [];
      }).filter((answer, index, list) =>
        list.findIndex((item) => item.questionId === answer.questionId) === index,
      )
      : [];
    return {
      reviewQuestionIds,
      session: {
        questionIds,
        currentIndex: Math.min(
          Math.max(0, Number.isInteger(parsed.session.currentIndex) ? parsed.session.currentIndex : 0),
          questionIds.length - 1,
        ),
        answers,
        elapsedSeconds: Math.max(0, Math.floor(Number(parsed.session.elapsedSeconds) || 0)),
        updatedAt: typeof parsed.session.updatedAt === "string" ? parsed.session.updatedAt : "",
      },
    };
  } catch {
    return empty;
  }
}
