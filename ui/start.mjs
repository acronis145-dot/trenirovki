// Главный экран («сколько ещё раз успеешь?») и список всех тренировок.

import { SESSIONS } from '../data/program.mjs';
import { pickSession, REST } from '../logic/today.mjs';
import { doneThisWeek, activeWorkout } from '../logic/records.mjs';
import { todayLocal, daysBetween } from '../logic/week.mjs';
import { lastBackupDate } from '../logic/storage.mjs';
import { state, phone } from './state.mjs';
import { h, go, topbar, fmtDate, minutesText } from './dom.mjs';

// Safari стирает данные сайта, который не открывали 7 дней; приложение с
// экрана «Домой» это не касается.
const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const installHint = () => (installed() ? null : h('p', { class: 'banner' },
  'Добавь приложение на экран «Домой»: Поделиться → «На экран „Домой“». Иначе Safari может стереть записи, если не открывать его 7 дней.'));

const BACKUP_EVERY_DAYS = 7;

function backupHint() {
  const { store } = state;
  if (store.workouts.length === 0 && store.bodyWeights.length === 0) return null;
  const last = lastBackupDate(phone);
  if (last && daysBetween(last, todayLocal()) < BACKUP_EVERY_DAYS) return null;
  return h('a', { class: 'banner', href: '#/backup' },
    last ? `Копия записей не сохранялась с ${fmtDate(last)} — сохрани` : 'Копия записей ещё ни разу не сохранялась — сохрани');
}

const CHOICES = [
  [1, 'Только сегодня', 'одна тренировка на неделе'],
  [2, 'Сегодня и ещё раз', 'две тренировки на неделе'],
  [3, 'Сегодня и ещё два', 'три тренировки на неделе'],
];

const TILES = [
  ['#/history', 'История', 'все тренировки'],
  ['#/progress', 'Прогресс', 'графики весов'],
  ['#/weight', 'Вес тела', 'средний за неделю'],
  ['#/backup', 'Копия', 'сохранить записи'],
];

// Сделанное на этой неделе — точками: одна точка — одна тренировка.
function weekLine(done) {
  return h('div', { class: 'week' },
    h('span', { class: 'eyebrow' }, 'Эта неделя'),
    h('span', { class: 'week-dots', 'aria-label': `Тренировок на этой неделе: ${done.length}` },
      [0, 1, 2].map((i) => h('i', { class: i < done.length ? 'on' : '' }))),
    h('span', { class: 'muted small' }, done.length ? done.map((id) => SESSIONS[id].title).join(' · ') : 'пока ни одной'));
}

export function startScreen(selected) {
  const today = todayLocal();
  const going = activeWorkout(state.store, today);
  const resume = going && going.sets.length > 0 ? going : null;
  const done = doneThisWeek(state.store, today);
  const pick = selected ? pickSession(done, selected) : null;
  return [
    installHint(),
    backupHint(),
    weekLine(done),
    resume ? h('a', { class: 'card hero', href: `#/w/${resume.session}` },
      h('span', { class: 'eyebrow' }, 'Идёт тренировка'),
      h('span', { class: 'hero-title' }, SESSIONS[resume.session].title),
      h('span', { class: 'accent' }, `Продолжить · подходов: ${resume.sets.length}`)) : null,
    h('h1', {}, 'Сколько ещё раз успеешь на этой неделе?'),
    h('p', { class: 'muted' }, 'Считая сегодня — тренировка подстроится.'),
    h('div', { class: 'choices', role: 'group', 'aria-label': 'Сколько раз' },
      CHOICES.map(([n, title, sub]) => h('button', {
        class: 'choice', type: 'button', 'aria-pressed': String(selected === n),
        onclick: () => go(`#/start/${n}`),
      }, h('span', { class: 'num' }, n), h('span', { class: 'label' }, h('b', {}, title), h('span', { class: 'muted small' }, sub))))),
    pick && pick !== REST ? h('div', { class: 'card hero' },
      h('span', { class: 'eyebrow' }, 'Сегодня'),
      h('span', { class: 'hero-title' }, SESSIONS[pick].title),
      h('span', { class: 'muted' }, minutesText(SESSIONS[pick]))) : null,
    pick === REST ? h('div', { class: 'card hero' },
      h('span', { class: 'hero-title' }, 'Сегодня — отдых'),
      h('span', { class: 'muted' }, 'Трёх тренировок в неделю достаточно.')) : null,
    h('nav', { class: 'tiles' }, TILES.map(([href, title, sub]) => h('a', { class: 'tile', href },
      h('b', {}, title), h('span', { class: 'muted small' }, sub)))),
    h('button', { class: 'link-button', type: 'button', onclick: () => go('#/sessions') }, 'Выбрать другую тренировку'),
    pick && pick !== REST ? h('div', { class: 'action-bar' },
      h('a', { class: 'primary', href: `#/w/${pick}` }, 'Начать')) : null,
  ];
}

export function sessionsScreen() {
  return [
    topbar('Все тренировки', '#/'),
    h('div', { class: 'rows' }, Object.entries(SESSIONS).map(([id, s]) => h('button', {
      class: 'row', type: 'button', onclick: () => go(`#/w/${id}`),
    }, h('b', {}, s.title), h('span', { class: 'muted small' }, minutesText(s))))),
  ];
}
