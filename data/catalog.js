/*
 * Register each prepared chapter here. Question content lives in separate
 * chapter-XX.js files; unprepared entries intentionally have no data file.
 */
window.LINUX_QUIZ_CATALOG = Array.from({ length: 36 }, (_, index) => {
  const number = index + 1;
  return {
    number,
    title: `Глава ${String(number).padStart(2, "0")}`,
    file: null
  };
});

[
  {
    number: 1,
    title: "Глава 1. Основы командной строки",
    file: "data/chapter-01.js"
  },
  {
    number: 2,
    title: "Глава 2. Навигация",
    file: "data/chapter-02.js"
  },
  {
    number: 3,
    title: "Глава 3. Исследование системы",
    file: "data/chapter-03.js"
  },
  {
    number: 4,
    title: "Глава 4. Операции с файлами и каталогами",
    file: "data/chapter-04.js"
  },
  {
    number: 5,
    title: "Глава 5. Работа с командами",
    file: "data/chapter-05.js"
  },
  {
    number: 6,
    title: "Глава 6. Перенаправление",
    file: "data/chapter-06.js"
  },
  {
    number: 7,
    title: "Глава 7. Взгляд на мир глазами командной оболочки",
    file: "data/chapter-07.js"
  },
  {
    number: 8,
    title: "Глава 8. Продвинутые приемы работы с клавиатурой",
    file: "data/chapter-08.js"
  },
  {
    number: 9,
    title: "Глава 9. Привилегии",
    file: "data/chapter-09.js"
  },
  {
    number: 10,
    title: "Глава 10. Процессы",
    file: "data/chapter-10.js"
  },
  {
    number: 11,
    title: "Глава 11. Окружение",
    file: "data/chapter-11.js"
  },
  {
    number: 12,
    title: "Глава 12. Плавное введение в vi",
    file: "data/chapter-12.js"
  }
].forEach((chapter) => {
  window.LINUX_QUIZ_CATALOG[chapter.number - 1] = chapter;
});
