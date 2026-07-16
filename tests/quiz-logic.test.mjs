import assert from "node:assert/strict";
import test from "node:test";
import {
  BASIC_ORDER_QUIZ,
  QUIZ_LESSON,
  choiceLabel,
  mergeQuizOverrides,
  scoreQuiz,
} from "../app/lib/quiz.mjs";

test("ships the complete 7/16 basic-order quiz", () => {
  assert.equal(QUIZ_LESSON.label, "7/16　ねじまき鳥先生");
  assert.equal(QUIZ_LESSON.title, "基本序列マスタークイズ");
  assert.equal(QUIZ_LESSON.videoUrl, "https://youtu.be/NE1UHrZkg6g");
  assert.equal(BASIC_ORDER_QUIZ.length, 30);
  assert.deepEqual(
    BASIC_ORDER_QUIZ.map(({ id }) => id),
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    BASIC_ORDER_QUIZ.map(({ correctIndex }) => correctIndex),
    [1, 1, 2, 1, 2, 1, 2, 2, 0, 2, 2, 1, 3, 1, 2, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2],
  );
});

test("every quiz question has four choices and one valid answer", () => {
  for (const question of BASIC_ORDER_QUIZ) {
    assert.equal(question.options.length, 4, `Q${question.id}`);
    assert.equal(question.options.every((option) => option.trim().length > 0), true, `Q${question.id}`);
    assert.equal(Number.isInteger(question.correctIndex), true, `Q${question.id}`);
    assert.equal(question.correctIndex >= 0 && question.correctIndex < 4, true, `Q${question.id}`);
    assert.equal(question.explanation.trim().length > 0, true, `Q${question.id}`);
  }
  assert.equal(choiceLabel(0), "A");
  assert.equal(choiceLabel(3), "D");
});

test("preserves representative answers and fixes obvious source typos", () => {
  assert.equal(BASIC_ORDER_QUIZ[0].correctIndex, 1);
  assert.equal(BASIC_ORDER_QUIZ[7].options[BASIC_ORDER_QUIZ[7].correctIndex], "他家連風 → 三元牌 → 自風");
  assert.equal(BASIC_ORDER_QUIZ[17].explanation.includes("順子"), true);
  assert.equal(BASIC_ORDER_QUIZ[17].explanation.includes("（瞬）"), false);
  assert.equal(BASIC_ORDER_QUIZ[29].question.includes("染め色＋字牌"), true);
  assert.equal(BASIC_ORDER_QUIZ[29].correctIndex, 2);
});

test("scores complete and retry-sized quiz sessions", () => {
  assert.deepEqual(
    scoreQuiz([
      { questionId: 1, selectedIndex: 1, correct: true },
      { questionId: 2, selectedIndex: 0, correct: false },
      { questionId: 3, selectedIndex: 2, correct: true },
    ], 3),
    { correct: 2, wrong: 1, rate: 67 },
  );
  assert.deepEqual(scoreQuiz([], 0), { correct: 0, wrong: 0, rate: 0 });
});

test("merges public quiz overrides without mutating bundled questions", () => {
  const edited = mergeQuizOverrides(BASIC_ORDER_QUIZ, [{
    quizId: QUIZ_LESSON.id,
    id: 1,
    question: "管理画面で編集した4択問題",
    options: ["編集A", "編集B", "編集C", "編集D"],
    correctIndex: 3,
    explanation: "管理画面で編集した解説",
  }]);
  assert.equal(edited[0].question, "管理画面で編集した4択問題");
  assert.deepEqual(edited[0].options, ["編集A", "編集B", "編集C", "編集D"]);
  assert.equal(edited[0].correctIndex, 3);
  assert.notEqual(edited[0], BASIC_ORDER_QUIZ[0]);
  assert.notEqual(edited[0].options, BASIC_ORDER_QUIZ[0].options);
  assert.notEqual(BASIC_ORDER_QUIZ[0].question, "管理画面で編集した4択問題");
});
