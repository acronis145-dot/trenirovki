// Вход в приложение: выбор экрана по адресу (#/…), запуск.
// Экраны: start.mjs (главная), workout.mjs (тренировка и подход),
// card.mjs (карточка упражнения), progress.mjs (итог, история, прогресс,
// вес тела), backup.mjs (копия записей). Записи — state.mjs.

import { keeper, state, setRerender } from './state.mjs';
import { h, topbar } from './dom.mjs';
import { startScreen, sessionsScreen } from './start.mjs';
import { workoutScreen, setScreen, keepAwake } from './workout.mjs';
import { exerciseScreen } from './card.mjs';
import { summaryScreen, historyScreen, progressScreen, exerciseProgressScreen, weightScreen } from './progress.mjs';
import { backupScreen, brokenScreen } from './backup.mjs';

const app = document.getElementById('app');

// Просим браузер не стирать данные при нехватке места; ответ ни на что не
// влияет — на iPhone главная защита в установке на экран «Домой».
navigator.storage?.persist?.().catch(() => {});

// Работа без интернета: sw.js собирается при публикации (инструменты/сайт.mjs).
// Не зарегистрировался — приложение работает как обычно, только с сетью;
// записи от этого не зависят.
navigator.serviceWorker?.register('./sw.js').catch(() => {});

const notFound = () => [topbar(null, '#/'), h('h1', {}, 'Такого экрана нет'), h('a', { class: 'primary', href: '#/' }, 'На главную')];

// Не сохранилось — видно на любом экране, пока следующая запись не удастся.
const saveErrorBanner = () => (state.saveError ? h('p', { class: 'banner error', role: 'alert' }, state.saveError) : null);

// scroll — к началу экрана при переходе; при нажатиях внутри экрана (±,
// отмена) страница остаётся на месте.
function render(scroll = true) {
  const [, screen, arg, sub] = (location.hash || '#/').split('/');
  const views = {
    '': () => startScreen(null),
    start: () => startScreen(Number(arg) || null),
    sessions: sessionsScreen,
    w: () => (sub ? setScreen(arg, sub) : workoutScreen(arg)),
    x: () => exerciseScreen(arg),
    done: () => summaryScreen(arg),
    history: historyScreen,
    progress: () => (arg ? exerciseProgressScreen(arg) : progressScreen()),
    weight: weightScreen,
    backup: backupScreen,
  };
  const view = keeper.ok ? (views[screen] ?? notFound) : brokenScreen;
  app.replaceChildren(...[saveErrorBanner(), view() ?? notFound()].flat(3).filter(Boolean));
  if (scroll) window.scrollTo(0, 0);
  keepAwake(keeper.ok && screen === 'w');
}

setRerender(() => render(false));
addEventListener('hashchange', () => render());
// Вернулась в приложение — Safari мог снять запрет гаснуть экрану.
document.addEventListener('visibilitychange', () => keepAwake(document.visibilityState === 'visible' && location.hash.startsWith('#/w/')));
render();
