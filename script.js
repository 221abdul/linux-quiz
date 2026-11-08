const PASS_PROGRESS_KEY = "linuxQuizProgress";
const PASS_PROGRESS_VERSION = 2;
const answerLetters = ["A", "B", "C", "D"];
const chapterData = new Map();
const chapterLoadErrors = new Map();

window.LinuxQuizData = {
  register(number, questions) {
    if (!Number.isInteger(number) || chapterData.has(number)) return;
    chapterData.set(number, questions);
  }
};

const counter = document.getElementById("question-counter");
const scoreChip = document.getElementById("score-chip");
const progressFill = document.getElementById("progress-fill");
const questionTotal = document.getElementById("question-total");
const backButton = document.getElementById("back-btn");
const nextButton = document.getElementById("next-btn");
const stepDots = document.getElementById("step-dots");
const questionArea = document.getElementById("question-area");
const chapterList = document.getElementById("chapter-list");
const catalogView = document.getElementById("catalog-view");
const learningLayout = document.getElementById("learning-layout");
const catalogGrid = document.getElementById("catalog-grid");
const catalogBack = document.getElementById("catalog-back");
const chapterArt = ["⌘", "⌂", "◉", "▤", "$_", "⇥", "✳", "⌨", "⚿", "◌", "⌁"];
const chapterColors = ["coral", "yellow", "mint", "lavender", "blue", "orange"];
const chapterDescriptions = ["Первые команды и уверенная работа в оболочке.", "Пути, папки и навигация по файловой системе.", "Узнай, что происходит внутри системы.", "Создавай, копируй и перемещай файлы.", "Находи нужные программы и изучай их устройство.", "Потоки данных, конвейеры и перенаправление.", "Переменные, подстановки и поведение оболочки.", "Работай быстрее с историей и горячими клавишами.", "Пользователи, права доступа и безопасность.", "Запускай, отслеживай и управляй процессами.", "Настрой переменные и окружение пользователя."];

let chapters = Array.isArray(window.LINUX_QUIZ_CATALOG) ? window.LINUX_QUIZ_CATALOG : [];
let chapterStates = new Map();
let progressState = loadProgress();
let activeChapter = null;
let questions = [];
let currentQuestion = 0;
let selectedAnswers = [];
let score = 0;

function loadProgress() {
  const emptyProgress = { version: PASS_PROGRESS_VERSION, results: {} };
  try {
    const saved = JSON.parse(window.localStorage.getItem(PASS_PROGRESS_KEY));
    if (!saved || typeof saved !== "object") return emptyProgress;

    if (saved.version === PASS_PROGRESS_VERSION && saved.results && typeof saved.results === "object") {
      const results = {};
      Object.entries(saved.results).forEach(([number, result]) => {
        if (!result || typeof result !== "object") return;
        results[number] = {
          score: Number.isInteger(result.score) ? result.score : 0,
          bestScore: Number.isInteger(result.bestScore) ? result.bestScore : (Number.isInteger(result.score) ? result.score : 0),
          total: Number.isInteger(result.total) ? result.total : null,
          passed: result.passed === true
        };
      });
      return { version: PASS_PROGRESS_VERSION, results };
    }

    // Migrate the previous { completed: [...] } format without inventing progress.
    if (Array.isArray(saved.completed)) {
      const results = {};
      saved.completed.forEach((passed, index) => {
        if (passed === true) {
          results[String(index + 1)] = { score: 0, bestScore: 0, total: null, passed: true };
        }
      });
      return { version: PASS_PROGRESS_VERSION, results };
    }
  } catch {
    // Missing, blocked, or malformed storage should not prevent the quiz from loading.
  }
  return emptyProgress;
}

function saveProgress() {
  try {
    window.localStorage.setItem(PASS_PROGRESS_KEY, JSON.stringify(progressState));
  } catch {
    // The current session remains usable if browser storage is unavailable.
  }
}

function loadChapterFile(chapter) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = new URL(chapter.file, document.baseURI).href;
    script.onload = () => resolve();
    script.onerror = () => {
      chapterLoadErrors.set(chapter.number, "Не удалось загрузить файл вопросов.");
      resolve();
    };
    document.head.appendChild(script);
  });
}

function validateQuestions(chapter, data) {
  if (!Array.isArray(data) || data.length === 0) {
    return { valid: false, error: "В этой главе пока нет вопросов." };
  }

  for (let index = 0; index < data.length; index++) {
    const question = data[index];
    const requiredText = [question?.topic, question?.question, question?.explanation];
    if (requiredText.some((value) => typeof value !== "string" || value.trim() === "")) {
      return { valid: false, error: `Вопрос ${index + 1}: заполните тему, вопрос и пояснение.` };
    }
    if (!Array.isArray(question.answers) || question.answers.length !== 4 || question.answers.some((answer) => typeof answer !== "string" || answer.trim() === "")) {
      return { valid: false, error: `Вопрос ${index + 1}: необходимо указать ровно четыре непустых варианта ответа.` };
    }
    if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct > 3) {
      return { valid: false, error: `Вопрос ${index + 1}: индекс правильного ответа должен быть от 0 до 3.` };
    }
  }

  return { valid: true, questions: data, passScore: Math.ceil(data.length * 0.8) };
}

async function initialize() {
  if (!chapters.length) {
    showApplicationError("Не найден каталог глав. Проверьте подключение data/catalog.js.");
    return;
  }

  const chapterFiles = chapters.filter((chapter) => typeof chapter.file === "string" && chapter.file.trim() !== "");
  await Promise.all(chapterFiles.map(loadChapterFile));

  chapters.forEach((chapter) => {
    let state;
    if (!chapter.file) {
      state = { valid: false, missing: true, error: "Вопросы для этой главы ещё не добавлены." };
    } else if (chapterLoadErrors.has(chapter.number)) {
      state = { valid: false, error: chapterLoadErrors.get(chapter.number) };
    } else {
      state = validateQuestions(chapter, chapterData.get(chapter.number));
    }
    chapterStates.set(chapter.number, state);
  });

  let progressChanged = false;
  chapters.forEach((chapter) => {
    const result = progressState.results[String(chapter.number)];
    const state = chapterStates.get(chapter.number);
    if (!result || !state?.valid) return;
    const passed = result.bestScore >= state.passScore;
    if (result.passed !== passed) {
      result.passed = passed;
      progressChanged = true;
    }
  });
  if (progressChanged) saveProgress();

  renderChapterList();
  renderCatalog();
  document.getElementById("ready-count").textContent = chapters.filter((chapter) => chapterStates.get(chapter.number)?.valid).length;
}

function renderCatalog() {
  catalogGrid.innerHTML = "";
  const query = document.getElementById("chapter-search").value.trim().toLocaleLowerCase("ru");
  let visibleCount = 0;
  document.getElementById("catalog-count").textContent = `${chapters.length} тем`;
  chapters.forEach((chapter, index) => {
    const state = chapterStates.get(chapter.number) || {};
    const result = progressState.results[String(chapter.number)];
    const available = state.valid === true;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `catalog-card ${chapterColors[index % chapterColors.length]}${available ? "" : " unavailable"}${result?.passed ? " completed" : ""}`;
    card.disabled = !available;
    card.innerHTML = `<span class="card-art" aria-hidden="true"><span class="card-art-mark"></span><span class="card-art-no"></span></span><span class="card-body"><span class="card-eyebrow"></span><strong class="card-title"></strong><span class="card-description"></span><span class="card-meta"><span class="card-status"></span><span class="card-arrow">↗</span></span></span>`;
    card.querySelector(".card-art-mark").textContent = chapterArt[index % chapterArt.length];
    card.querySelector(".card-art-no").textContent = String(chapter.number).padStart(2, "0");
    card.querySelector(".card-eyebrow").textContent = `ГЛАВА ${String(chapter.number).padStart(2, "0")}`;
    card.querySelector(".card-title").textContent = (chapter.title || `Глава ${chapter.number}`).replace(/^Глава\s*\d+\.\s*/i, "");
    card.querySelector(".card-description").textContent = chapterDescriptions[index] || (available ? "Изучи тему и проверь себя в коротком тесте." : "Материалы этой главы скоро появятся.");
    card.querySelector(".card-status").textContent = result?.passed ? `✓ Пройдено · ${result.bestScore}/${result.total || state.questions?.length || "—"}` : available ? `${state.questions.length} вопросов · порог ${Math.ceil((state.passScore / state.questions.length) * 100)}%` : "СКОРО";
    card.hidden = query !== "" && !`${chapter.title} ${chapterDescriptions[index] || ""} ${chapter.number}`.toLocaleLowerCase("ru").includes(query);
    if (!card.hidden) visibleCount++;
    card.addEventListener("click", () => selectChapter(chapter.number));
    catalogGrid.appendChild(card);
  });
  document.getElementById("no-results").hidden = visibleCount !== 0;
}

function renderChapterList() {
  chapterList.innerHTML = "";
  chapters.forEach((chapter) => {
    const state = chapterStates.get(chapter.number) || { valid: false, missing: !chapter.file };
    const available = state.valid === true;
    const result = progressState.results[String(chapter.number)];
    const passed = result?.passed === true;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chapter-link${activeChapter?.number === chapter.number ? " active" : ""}${passed ? " passed" : ""}`;
    button.disabled = !available;
    button.setAttribute("aria-current", activeChapter?.number === chapter.number ? "page" : "false");

    const icon = passed ? "✓" : available ? String(chapter.number).padStart(2, "0") : "…";
    button.innerHTML = `<span class="chapter-icon" aria-hidden="true"></span><span class="chapter-copy"><strong></strong><small></small></span>`;
    button.querySelector(".chapter-icon").textContent = icon;
    button.querySelector("strong").textContent = chapter.title || `Глава ${chapter.number}`;

    let status;
    if (passed) {
      status = Number.isInteger(result.bestScore) && result.total ? `Пройдено · лучший результат ${result.bestScore}/${result.total}` : "Пройдено";
    } else if (available) {
      status = `${state.questions.length} вопросов · нужно ${state.passScore} верных`;
    } else {
      status = state.missing ? "В разработке" : "Вопросы недоступны";
    }
    button.querySelector("small").textContent = status;
    button.addEventListener("click", () => selectChapter(chapter.number));
    chapterList.appendChild(button);
  });
}

function resetQuestionArea() {
  questionArea.innerHTML = `<h2 id="question-title"></h2><p class="question-hint">Выбери один правильный вариант ответа.</p><div class="answers" id="answers" role="group" aria-label="Варианты ответа"></div><div class="feedback" id="feedback" aria-live="polite" hidden></div>`;
}

function selectChapter(number) {
  const chapter = chapters.find((item) => item.number === number);
  if (!chapter || !chapterStates.get(number)?.valid) return;

  activeChapter = chapter;
  catalogView.hidden = true;
  learningLayout.hidden = false;
  const state = chapterStates.get(number);
  renderChapterList();
  renderCatalog();
  if (!state?.valid) {
    showUnavailableChapter(state?.error || "Данные этой главы пока недоступны.");
    return;
  }

  questions = state.questions;
  currentQuestion = 0;
  selectedAnswers = Array(questions.length).fill(null);
  score = 0;
  resetQuestionArea();
  backButton.hidden = false;
  nextButton.hidden = false;
  stepDots.hidden = false;
  buildDots();
  renderQuestion();
}

catalogBack.addEventListener("click", () => {
  learningLayout.hidden = true;
  catalogView.hidden = false;
  renderCatalog();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
document.getElementById("chapter-search").addEventListener("input", renderCatalog);

function showUnavailableChapter(message) {
  counter.textContent = activeChapter.title;
  scoreChip.textContent = "Тест недоступен";
  progressFill.style.width = "0%";
  questionArea.innerHTML = `<div class="data-message"><div class="question-kicker">ГЛАВА ПОКА НЕ ГОТОВА</div><h2></h2><p></p></div>`;
  questionArea.querySelector("h2").textContent = activeChapter.title;
  questionArea.querySelector("p").textContent = message;
  backButton.hidden = true;
  nextButton.hidden = true;
  stepDots.hidden = true;
}

function showApplicationError(message) {
  questionArea.innerHTML = `<div class="data-message"><h2>Не удалось загрузить викторину</h2><p></p></div>`;
  questionArea.querySelector("p").textContent = message;
  backButton.hidden = true;
  nextButton.hidden = true;
  stepDots.hidden = true;
}

function buildDots() {
  stepDots.innerHTML = "";
  questions.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.className = "step-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Перейти к вопросу ${index + 1}`);
    dot.addEventListener("click", () => {
      if (selectedAnswers[currentQuestion] !== null || index < currentQuestion) {
        currentQuestion = index;
        renderQuestion();
      }
    });
    stepDots.appendChild(dot);
  });
}

function renderQuestion() {
  const question = questions[currentQuestion];
  const title = document.getElementById("question-title");
  const answersBox = document.getElementById("answers");
  const hint = document.querySelector(".question-hint");
  const feedback = document.getElementById("feedback");

  counter.textContent = `Вопрос ${currentQuestion + 1} из ${questions.length}`;
  scoreChip.textContent = `Счёт: ${score}`;
  progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
  title.textContent = question.question;
  hint.hidden = selectedAnswers[currentQuestion] !== null;
  answersBox.innerHTML = "";
  feedback.hidden = selectedAnswers[currentQuestion] === null;
  feedback.className = "feedback";
  if (selectedAnswers[currentQuestion] !== null) showFeedback(question, selectedAnswers[currentQuestion]);

  question.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer";
    button.innerHTML = `<span class="answer-letter">${answerLetters[index]}</span><span class="answer-text"></span><span class="answer-mark"></span>`;
    button.querySelector(".answer-text").textContent = answer;
    button.setAttribute("aria-pressed", selectedAnswers[currentQuestion] === index ? "true" : "false");

    if (selectedAnswers[currentQuestion] !== null) {
      button.disabled = true;
      if (index === question.correct) {
        button.classList.add("correct");
        button.querySelector(".answer-mark").textContent = "✓";
      } else if (index === selectedAnswers[currentQuestion]) {
        button.classList.add("incorrect");
        button.querySelector(".answer-mark").textContent = "×";
      }
    } else {
      button.addEventListener("click", () => chooseAnswer(index));
    }
    answersBox.appendChild(button);
  });

  backButton.disabled = currentQuestion === 0;
  nextButton.disabled = selectedAnswers[currentQuestion] === null;
  nextButton.innerHTML = currentQuestion === questions.length - 1 ? "<span>Результат</span> →" : "<span>Далее</span> →";
  [...stepDots.children].forEach((dot, index) => {
    dot.classList.toggle("active", index === currentQuestion);
    dot.classList.toggle("done", selectedAnswers[index] !== null && index !== currentQuestion);
  });
}

function chooseAnswer(index) {
  if (selectedAnswers[currentQuestion] !== null) return;
  selectedAnswers[currentQuestion] = index;
  if (index === questions[currentQuestion].correct) score++;
  renderQuestion();
}

function showFeedback(question, answerIndex) {
  const feedback = document.getElementById("feedback");
  const isCorrect = answerIndex === question.correct;
  feedback.hidden = false;
  feedback.classList.add(isCorrect ? "good" : "bad");
  feedback.innerHTML = `<strong>${isCorrect ? "✓ Правильно!" : "✕ Не совсем правильно"}</strong><span></span>`;
  feedback.querySelector("span").textContent = `${isCorrect ? "" : `Правильный ответ: ${answerLetters[question.correct]}. ${question.answers[question.correct]} `}${question.explanation}`;
}

function showResults() {
  const total = questions.length;
  const passScore = chapterStates.get(activeChapter.number).passScore;
  const passedNow = score >= passScore;
  const savedResult = progressState.results[String(activeChapter.number)];
  const bestScore = Math.max(savedResult?.bestScore || 0, score);
  progressState.results[String(activeChapter.number)] = {
    score,
    bestScore,
    total,
    passed: bestScore >= passScore
  };
  saveProgress();
  renderChapterList();

  const percent = Math.round((score / total) * 100);
  const heading = passedNow ? (score === total ? "Отличный результат!" : "Глава пройдена!") : "Пока не пройдено";
  const description = passedNow
    ? "Ты успешно завершил этот тест. Можно выбрать любую главу с вопросами в списке слева."
    : `Нужно минимум ${passScore} правильных ответов. Попробуй ещё раз.`;
  const practiceBlock = activeChapter.title === "Глава 12. Плавное введение в vi"
    ? `<aside class="practice-cta" aria-labelledby="practice-cta-title"><h3 id="practice-cta-title">Хочешь прокачать навыки работы с vi?</h3><p>Закрепи знания на практике в интерактивном тренажёре Vim Legends. Изучай команды vi/vim и тренируйся прямо в браузере</p><a class="practice-cta-link" href="https://vimlegends.com/" target="_blank" rel="noopener noreferrer">Перейти к тренажёру vi →</a></aside>`
    : "";

  counter.textContent = "Тест завершён";
  scoreChip.textContent = `${percent}%`;
  progressFill.style.width = "100%";
  questionArea.innerHTML = `<div class="result-view" data-passed="${passedNow}"><div class="result-icon">${passedNow ? "✓" : "↻"}</div><div class="question-kicker">${activeChapter.title} · ${passedNow ? "ТЕСТ ПРОЙДЕН" : "НУЖНА ЕЩЁ ОДНА ПОПЫТКА"}</div><h2>${heading}</h2><p></p><div class="result-score">${score}<span> / ${total}</span></div><div class="result-bar"><div style="width:${percent}%"></div></div><p>Правильных ответов: ${score}<br>Ошибок: ${total - score}<br>Результат: ${percent}% · проходной балл: ${passScore}/${total} (80%)</p>${practiceBlock}<div class="result-actions"><button class="btn btn-primary" id="retry-btn" type="button">Пройти ещё раз ↻</button><button class="btn btn-secondary" id="review-btn" type="button">Разобрать ответы</button><button class="btn btn-secondary" id="results-catalog-btn" type="button">К каталогу</button></div></div>`;
  questionArea.querySelector(".result-view > p").textContent = description;
  backButton.hidden = true;
  nextButton.hidden = true;
  stepDots.hidden = true;
  document.getElementById("retry-btn").addEventListener("click", restartQuiz);
  document.getElementById("review-btn").addEventListener("click", reviewAnswers);
  document.getElementById("results-catalog-btn").addEventListener("click", () => catalogBack.click());
}

function reviewAnswers() {
  currentQuestion = 0;
  resetQuestionArea();
  backButton.hidden = false;
  nextButton.hidden = false;
  stepDots.hidden = false;
  buildDots();
  renderQuestion();
}

function restartQuiz() {
  currentQuestion = 0;
  selectedAnswers = Array(questions.length).fill(null);
  score = 0;
  resetQuestionArea();
  backButton.hidden = false;
  nextButton.hidden = false;
  stepDots.hidden = false;
  buildDots();
  renderQuestion();
}

backButton.addEventListener("click", () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
});

nextButton.addEventListener("click", () => {
  if (selectedAnswers[currentQuestion] === null) return;
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  } else {
    showResults();
  }
});

initialize();
