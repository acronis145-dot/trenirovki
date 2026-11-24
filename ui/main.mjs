// Экраны приложения. Только показ и нажатия: решения принимает логика
// (app/logic), состав программы — data/program.mjs. Тексты вставляются через
// textContent — никакой разметки из данных.
//
// Записи хранятся в памяти телефона (logic/storage.mjs). Все изменения
// проходят через commit(): сначала запись в память, и только если она
// удалась — экран идёт дальше. Не удалось — ошибка на экране, а нажатие
// не засчитано.

import { SESSIONS, EXERCISES, GROUPS, WARMUP, COOLDOWN, RULES } from '../data/program.mjs';
import { pickSession, REST } from '../logic/today.mjs';
import { planSession, startText, weightText, estimateMinutes, lastSets } from '../logic/plan.mjs';
import {
  emptyStore, doneThisWeek, startWorkout, recordSet, undoLastSet, finishWorkout, activeWorkout,
  recordBodyWeight, weeklyBodyWeight,
} from '../logic/records.mjs';
import { nextSetDefaults, nextExercise, setsOf } from '../logic/workout.mjs';
import { todayLocal, daysBetween } from '../logic/week.mjs';
import { openStorage, backupFile, lastBackupDate, markBackup } from '../logic/storage.mjs';

const app = document.getElementById('app');

// Обращение к localStorage внутри функций: если Safari его запретит, ошибку
// поймает openStorage, а не загрузка страницы.
const phone = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};
const keeper = openStorage(phone);
let store = keeper.ok ? keeper.store : emptyStore();
let saveError = null;

// Просим браузер не стирать данные при нехватке места; ответ ни на что не
// влияет — на iPhone главная защита в установке на экран «Домой».
navigator.storage?.persist?.().catch(() => {});

// Работа без интернета: sw.js собирается при публикации (инструменты/сайт.mjs).
// Не зарегистрировался — приложение работает как обычно, только с сетью;
// записи от этого не зависят.
navigator.serviceWorker?.register('./sw.js').catch(() => {});

function commit(next) {
  try {
    keeper.save(next);
  } catch (e) {
    saveError = e.message;
    render(false);
    return false;
  }
  saveError = null;
  store = next;
  return true;
}

// --- Маленький помощник для разметки ---------------------------------------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const num = (x) => String(x).replace('.', ',');
const fmtKg = (kg) => `${num(kg)} кг`;
const fmtWeight = (ex, kg) => (kg === null ? '—' : weightText(ex, kg));
const fmtSet = (s) => `${fmtWeight(EXERCISES[s.exercise], s.weightKg)} × ${s.reps ?? '—'}`;
const minutesText = (s) => `≈ ${Math.round(estimateMinutes(s) / 5) * 5} мин`;
const ltName = (ex) => ex.lt ?? ex.ltNew;
const go = (hash) => { location.hash = hash; };

const DAY = new Intl.DateTimeFormat('ru', { weekday: 'short', day: 'numeric', month: 'long' });
const fmtDate = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return DAY.format(new Date(y, m - 1, d));
};

// Ввод числа с телефона: запятая или точка; пусто или мусор — null.
function parseNum(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// back — адрес экрана или функция (из карточки — «туда, откуда пришли»).
function topbar(title, back) {
  const onclick = typeof back === 'function' ? back : () => go(back);
  return h('div', { class: 'topbar' },
    back ? h('button', { class: 'back', type: 'button', onclick, 'aria-label': 'Назад' }, '‹ Назад') : null,
    title ? h('h2', {}, title) : null);
}

function list(items, ordered = false) {
  return h(ordered ? 'ol' : 'ul', {}, items.map((t) => h('li', {}, t)));
}

// Не сохранилось — видно на любом экране, пока следующая запись не удастся.
const saveErrorBanner = () => (saveError ? h('p', { class: 'banner error', role: 'alert' }, saveError) : null);

// Safari стирает данные сайта, который не открывали 7 дней; приложение с
// экрана «Домой» это не касается.
const installed = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const installHint = () => (installed() ? null : h('p', { class: 'banner' },
  'Добавь приложение на экран «Домой»: Поделиться → «На экран „Домой“». Иначе Safari может стереть записи, если не открывать его 7 дней.'));

const BACKUP_EVERY_DAYS = 7;

function backupHint() {
  if (store.workouts.length === 0 && store.bodyWeights.length === 0) return null;
  const last = lastBackupDate(phone);
  if (last && daysBetween(last, todayLocal()) < BACKUP_EVERY_DAYS) return null;
  return h('a', { class: 'banner', href: '#/backup' },
    last ? `Копия записей не сохранялась с ${fmtDate(last)} — сохрани` : 'Копия записей ещё ни разу не сохранялась — сохрани');
}

// Последний записанный подход идущей тренировки и его отмена (Р-28).
function undoLine(workout) {
  const last = workout && !workout.finished ? workout.sets.at(-1) : null;
  if (!last) return null;
  return h('div', { class: 'undo' },
    h('span', {}, h('span', { class: 'muted small' }, 'Записано: '), `${EXERCISES[last.exercise].ru}, ${fmtSet(last)}`),
    h('button', {
      class: 'link-button', type: 'button',
      onclick: () => { if (commit(undoLastSet(store, workout.id))) render(false); },
    }, 'Отменить'));
}

// --- Экран 1: «Сколько ещё раз успеешь?» -----------------------------------
const CHOICES = [
  [1, 'Только сегодня', 'одна тренировка на этой неделе'],
  [2, 'Сегодня и ещё раз', 'две тренировки на этой неделе'],
  [3, 'Сегодня и ещё два раза', 'три тренировки на этой неделе'],
];

function startScreen(selected) {
  const today = todayLocal();
  const going = activeWorkout(store, today);
  const resume = going && going.sets.length > 0 ? going : null;
  const done = doneThisWeek(store, today);
  const pick = selected ? pickSession(done, selected) : null;
  return [
    installHint(),
    backupHint(),
    resume ? h('a', { class: 'card today resume', href: `#/w/${resume.session}` },
      h('span', { class: 'muted small' }, 'Идёт тренировка'),
      h('span', { class: 'title' }, SESSIONS[resume.session].title),
      h('span', { class: 'accent' }, `Продолжить · подходов: ${resume.sets.length}`)) : null,
    h('h1', {}, 'Сколько ещё раз успеешь на этой неделе?'),
    h('p', { class: 'muted' }, 'Считая сегодня. Ответ можно поменять в следующий раз — тренировка подстроится.'),
    h('div', { class: 'choices', role: 'group', 'aria-label': 'Сколько раз' },
      CHOICES.map(([n, title, sub]) => h('button', {
        class: 'choice', type: 'button', 'aria-pressed': String(selected === n),
        onclick: () => go(`#/start/${n}`),
      }, h('span', { class: 'num' }, n), h('span', { class: 'label' }, h('b', {}, title), h('span', { class: 'muted small' }, sub))))),
    pick && pick !== REST ? h('div', { class: 'card today' },
      h('span', { class: 'muted small' }, 'Сегодня'),
      h('span', { class: 'title' }, SESSIONS[pick].title),
      h('span', { class: 'muted' }, minutesText(SESSIONS[pick]))) : null,
    pick === REST ? h('div', { class: 'card today' },
      h('span', { class: 'title' }, 'Сегодня — отдых'),
      h('span', { class: 'muted' }, 'Трёх тренировок в неделю достаточно.')) : null,
    h('nav', { class: 'links' },
      h('button', { class: 'link-button', type: 'button', onclick: () => go('#/sessions') }, 'Другая тренировка'),
      h('button', { class: 'link-button', type: 'button', onclick: () => go('#/history') }, 'История'),
      h('button', { class: 'link-button', type: 'button', onclick: () => go('#/weight') }, 'Вес тела'),
      h('button', { class: 'link-button', type: 'button', onclick: () => go('#/backup') }, 'Копия записей')),
    pick && pick !== REST ? h('div', { class: 'action-bar' },
      h('a', { class: 'primary', href: `#/w/${pick}` }, 'Начать')) : null,
  ];
}

// --- Экран: все тренировки -------------------------------------------------
function sessionsScreen() {
  return [
    topbar('Все тренировки', '#/'),
    h('div', { class: 'sessions' }, Object.entries(SESSIONS).map(([id, s]) => h('button', {
      class: 'session-link', type: 'button', onclick: () => go(`#/w/${id}`),
    }, h('span', {}, s.title), h('span', { class: 'muted small' }, minutesText(s))))),
  ];
}

// --- Экран 2: тренировка ---------------------------------------------------
// После первого подхода в строке — вес, с которым Ева работает сегодня, а не
// предложенный.
function exerciseButton(sessionId, e, workout) {
  const ex = EXERCISES[e.id];
  const today = setsOf(workout, e.id);
  const done = today.length;
  const complete = done >= e.sets;
  const kg = today.at(-1)?.weightKg ?? e.weightKg;
  const weight = kg === null ? 'подбор' : fmtWeight(ex, kg);
  return h('button', {
    class: `exercise${complete ? ' complete' : ''}`, type: 'button', onclick: () => go(`#/w/${sessionId}/${e.id}`),
  },
  h('span', { class: 'name' }, ex.ru),
  h('span', { class: 'dose' }, h('b', {}, `${e.sets} × ${e.reps}`), h('span', {}, weight)),
  h('span', { class: 'lt' }, ltName(ex)),
  h('span', { class: 'reason' }, done > 0 ? (complete ? `✓ Сделано: ${done} из ${e.sets}` : `Сделано: ${done} из ${e.sets}`) : e.reason));
}

function workoutScreen(id) {
  const s = SESSIONS[id];
  if (!s) return notFound();
  const today = todayLocal();
  const workout = activeWorkout(store, today, id);
  const plan = planSession(store, id, today, workout?.id);
  return [
    topbar(null, '#/'),
    h('h1', {}, s.title),
    h('p', { class: 'muted' }, minutesText(s)),
    plan.intro ? h('span', { class: 'badge' }, 'Первые 2 недели: меньше подходов, вес сам не растёт') : null,
    h('details', { class: 'card' }, h('summary', {}, 'Разминка · ≈ 10 мин'), list(WARMUP)),
    h('ul', { class: 'exercise-list' }, plan.items.map((it) => h('li', {},
      it.pair
        ? h('div', { class: 'pair' }, h('span', { class: 'pair-label' }, 'Пара — по очереди, отдых после второго'), it.exercises.map((e) => exerciseButton(id, e, workout)))
        : exerciseButton(id, it.exercises[0], workout)))),
    h('details', { class: 'card' }, h('summary', {}, 'Растяжка · ≈ 8 мин'), list(COOLDOWN)),
    h('details', { class: 'card' }, h('summary', {}, 'Правила'), list(RULES)),
    // Не прилипает к низу: список упражнений важнее, а закончить — один раз в конце.
    workout && workout.sets.length > 0 ? h('div', { class: 'finish' },
      undoLine(workout),
      finishButton(workout)) : null,
  ];
}

// Закончить — в два нажатия: после этого подходы тренировки уже не отменить
// (Р-28), а случайное касание в зале — обычное дело.
function finishButton(workout) {
  let armed = false;
  const btn = h('button', {
    class: 'primary', type: 'button',
    onclick: () => {
      if (!armed) { armed = true; btn.textContent = 'Точно закончить? Нажми ещё раз'; return; }
      if (commit(finishWorkout(store, workout.id))) go('#/history');
    },
  }, 'Закончить тренировку');
  return btn;
}

// --- Экран 3: подход -------------------------------------------------------
// Черновик значений на экране подхода: живёт, пока Ева не нажала «Сделано»
// или не ушла к другому подходу.
let draft = null;

function stepper(label, value, { step, min, decimal, onchange }) {
  const input = h('input', {
    class: 'stepper-value', type: 'text', inputmode: decimal ? 'decimal' : 'numeric',
    value: value === null ? '' : num(value), 'aria-label': label, autocomplete: 'off',
    oninput: (ev) => onchange(parseNum(ev.target.value), false),
  });
  const shift = (d) => {
    const base = value ?? (d > 0 ? 0 : min);
    onchange(Math.max(min, Math.round((base + d) * 100) / 100), true);
  };
  return h('div', { class: 'stepper' },
    h('span', { class: 'stepper-label' }, label),
    h('div', { class: 'stepper-row' },
      h('button', { class: 'step', type: 'button', 'aria-label': `${label}: меньше`, onclick: () => shift(-step) }, '−'),
      input,
      h('button', { class: 'step', type: 'button', 'aria-label': `${label}: больше`, onclick: () => shift(step) }, '+')));
}

const validSet = (d) => d.weightKg !== null && d.weightKg >= 0 && Number.isInteger(d.reps) && d.reps >= 1;

function setScreen(sessionId, exerciseId) {
  const ex = EXERCISES[exerciseId];
  if (!SESSIONS[sessionId] || !ex) return notFound();
  const today = todayLocal();
  const workout = activeWorkout(store, today, sessionId);
  const plan = planSession(store, sessionId, today, workout?.id);
  const planned = plan.items.flatMap((it) => it.exercises).find((e) => e.id === exerciseId);
  if (!planned) return notFound();

  const doneSets = setsOf(workout, exerciseId);
  const key = `${workout?.id ?? 'new'}:${exerciseId}:${doneSets.length}`;
  if (draft?.key !== key) draft = { key, ...nextSetDefaults(workout, planned) };
  const complete = doneSets.length >= planned.sets;
  const previous = lastSets(store, exerciseId, today, workout?.id);

  const doneButton = h('button', {
    class: complete ? 'secondary' : 'primary', type: 'button', disabled: !validSet(draft),
    onclick: () => {
      let s = store;
      let w = workout;
      if (!w) {
        w = { id: `${today}-${Date.now().toString(36)}` };
        s = startWorkout(s, { id: w.id, date: today, session: sessionId });
      }
      s = recordSet(s, w.id, { exercise: exerciseId, weightKg: draft.weightKg, reps: draft.reps, at: new Date().toISOString() });
      if (!commit(s)) return;
      const next = nextExercise(plan, activeWorkout(store, today, sessionId), exerciseId);
      if (next === exerciseId) render(false);
      else go(next ? `#/w/${sessionId}/${next}` : `#/w/${sessionId}`);
    },
  }, complete ? 'Записать ещё подход' : 'Сделано');

  const update = (field) => (value, rerender) => {
    draft[field] = value;
    if (rerender) render(false);
    else doneButton.disabled = !validSet(draft);
  };

  return [
    topbar(null, `#/w/${sessionId}`),
    h('h1', {}, ex.ru),
    h('p', { class: 'muted' }, ltName(ex)),
    h('p', { class: 'progress' }, complete
      ? `Все ${planned.sets} подхода по плану сделаны`
      : `Подход ${doneSets.length + 1} из ${planned.sets} · цель ${planned.reps} повторов`),
    h('div', { class: 'card steppers' },
      stepper(ex.perSide ? 'Диски с каждой стороны, кг' : 'Вес, кг', draft.weightKg, { step: ex.step, min: 0, decimal: true, onchange: update('weightKg') }),
      stepper('Повторы', draft.reps, { step: 1, min: 1, decimal: false, onchange: update('reps') }),
      draft.weightKg === null ? h('p', { class: 'muted small' }, 'Подбор: начни с самого лёгкого веса и запиши, какой взяла.') : null),
    h('p', { class: 'muted small' }, previous.length
      ? `В прошлый раз: ${previous.map(fmtSet).join(', ')} · ${planned.reason}`
      : planned.reason),
    doneSets.length ? h('div', { class: 'card' },
      h('div', { class: 'section-title' }, 'Сегодня'),
      h('ol', { class: 'set-list' }, doneSets.map((x) => h('li', {}, fmtSet(x))))) : null,
    h('button', { class: 'link-button', type: 'button', onclick: () => go(`#/x/${exerciseId}`) }, 'Как делать'),
    h('div', { class: 'action-bar' },
      undoLine(workout),
      complete ? h('a', { class: 'primary', href: `#/w/${sessionId}` }, 'К списку упражнений') : null,
      doneButton),
  ];
}

// --- Экран 4: карточка упражнения ------------------------------------------
function exerciseScreen(id) {
  const ex = EXERCISES[id];
  if (!ex) return notFound();
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video)}`;
  return [
    topbar(null, () => (history.length > 1 ? history.back() : go('#/'))),
    h('h1', {}, ex.ru),
    h('p', { class: 'muted' }, `${ltName(ex)} · ${GROUPS[ex.group].name}`),
    h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'Как делать'), h('ol', { class: 'cues' }, ex.cues.map((c) => h('li', {}, c)))),
    h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'Частые ошибки'), h('p', {}, ex.mistakes)),
    h('div', { class: 'card stop' }, h('div', { class: 'section-title' }, 'Когда остановиться'), h('p', {}, ex.stop)),
    ex.fallback ? h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'Если тренажёра нет'), h('p', {}, ex.fallback)) : null,
    h('div', { class: 'card' }, h('div', { class: 'section-title' }, 'Вес'),
      h('p', {}, `Старт: ${startText(ex)}`), h('p', { class: 'muted small' }, `Последний у тренера: ${ex.last}`)),
    h('div', { class: 'action-bar' },
      h('a', { class: 'primary', href: video, target: '_blank', rel: 'noopener' }, 'Видео на YouTube'),
      h('p', { class: 'muted small', style: 'text-align:center' }, 'Нужен интернет · откроется поиск, выбирай ролик тренера')),
  ];
}

// --- Экран: история --------------------------------------------------------
function historyScreen() {
  const workouts = store.workouts.filter((w) => w.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return [
    topbar('История', '#/'),
    workouts.length === 0 ? h('p', { class: 'muted' }, 'Пока нет записанных тренировок.') : null,
    workouts.map((w) => {
      const order = [...new Set(w.sets.map((x) => x.exercise))];
      return h('div', { class: 'card history' },
        h('div', { class: 'history-head' },
          h('b', {}, SESSIONS[w.session].title),
          h('span', { class: 'muted small' }, fmtDate(w.date))),
        w.finished ? null : h('span', { class: 'badge' }, 'Не закончена'),
        h('ul', { class: 'history-sets' }, order.map((id) => h('li', {},
          h('span', {}, EXERCISES[id].ru),
          h('span', { class: 'muted' }, setsOf(w, id).map(fmtSet).join(', '))))));
    }),
  ];
}

// --- Экран: вес тела -------------------------------------------------------
// Показывается средний за неделю, а не дневные скачки (Р-16).
let weightDraft = null;

function weightScreen() {
  const weeks = weeklyBodyWeight(store).reverse();
  const save = h('button', {
    class: 'primary', type: 'button', disabled: !(weightDraft > 0),
    onclick: () => {
      if (!commit(recordBodyWeight(store, { date: todayLocal(), kg: weightDraft }))) return;
      weightDraft = null;
      render(false);
    },
  }, 'Записать');
  return [
    topbar('Вес тела', '#/'),
    h('div', { class: 'card steppers' },
      h('label', { class: 'stepper' },
        h('span', { class: 'stepper-label' }, `Сегодня, ${fmtDate(todayLocal())}, кг`),
        h('input', {
          class: 'stepper-value', type: 'text', inputmode: 'decimal', autocomplete: 'off',
          value: weightDraft === null ? '' : num(weightDraft), placeholder: '0,0',
          oninput: (ev) => { weightDraft = parseNum(ev.target.value); save.disabled = !(weightDraft > 0); },
        }))),
    h('p', { class: 'muted small' }, 'Вес скачет день ото дня из-за воды и еды, поэтому главное — средний за неделю.'),
    weeks.length ? h('div', { class: 'card' },
      h('div', { class: 'section-title' }, 'Средний за неделю'),
      h('ul', { class: 'history-sets' }, weeks.map((w) => h('li', {},
        h('span', {}, `с ${fmtDate(w.week)}`),
        h('span', {}, h('b', {}, fmtKg(w.kg)), h('span', { class: 'muted small' }, ` · взвешиваний: ${w.count}`)))))) : null,
    h('div', { class: 'action-bar' }, save),
  ];
}

// --- Копия записей ----------------------------------------------------------
// На iPhone — меню «Поделиться» (сохранить в «Файлы», отправить в
// мессенджер); где его нет — обычное скачивание. Отказ Евы в меню (отмена)
// — не ошибка. Возвращает true, если файл отдан.
async function giveFile(name, text) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

function backupScreen() {
  const last = lastBackupDate(phone);
  const sets = store.workouts.reduce((n, w) => n + w.sets.length, 0);
  const status = h('p', { class: 'muted small', role: 'status' });
  const button = h('button', {
    class: 'primary', type: 'button',
    onclick: async () => {
      const today = todayLocal();
      const { name, text } = backupFile(store, today);
      try {
        if (!(await giveFile(name, text))) return;
      } catch (e) {
        status.textContent = `Копия не сохранилась: ${e.message}`;
        return;
      }
      markBackup(phone, today);
      render(false);
    },
  }, 'Сохранить копию');
  return [
    topbar('Копия записей', '#/'),
    h('p', {}, 'Записи хранятся только в этом телефоне. Раз в неделю сохраняй копию: в «Файлы» или отправь Владиславу — тогда ничего не потеряется, даже если с телефоном что-то случится.'),
    h('div', { class: 'card' },
      h('ul', { class: 'history-sets' },
        h('li', {}, h('span', {}, 'Тренировок'), h('b', {}, store.workouts.filter((w) => w.sets.length > 0).length)),
        h('li', {}, h('span', {}, 'Подходов'), h('b', {}, sets)),
        h('li', {}, h('span', {}, 'Взвешиваний'), h('b', {}, store.bodyWeights.length)),
        h('li', {}, h('span', {}, 'Последняя копия'), h('b', {}, last ? fmtDate(last) : 'ещё не было')))),
    status,
    h('div', { class: 'action-bar' }, button),
  ];
}

// Записи не прочитались: приложение ничего не пишет, только отдаёт то, что
// лежит в памяти, — чтобы Владислав разобрался и ничего не пропало.
function brokenScreen() {
  const status = h('p', { class: 'muted small', role: 'status' });
  return [
    h('h1', {}, 'Не могу прочитать записи'),
    h('p', { class: 'banner error' }, keeper.error),
    h('p', {}, 'Записи в телефоне не стёрты и не изменены. Не удаляй приложение и не чисти данные Safari. Сохрани то, что лежит в памяти, и отправь Владиславу.'),
    status,
    keeper.raw === null ? null : h('div', { class: 'action-bar' }, h('button', {
      class: 'primary', type: 'button',
      onclick: async () => {
        try {
          await giveFile(`trenirovki-ne-prochitano-${todayLocal()}.json`, keeper.raw);
        } catch (e) {
          status.textContent = `Не получилось: ${e.message}`;
        }
      },
    }, 'Сохранить то, что в памяти')),
  ];
}

function notFound() {
  return [topbar(null, '#/'), h('h1', {}, 'Такого экрана нет'), h('a', { class: 'primary', href: '#/' }, 'На главную')];
}

// --- Переходы --------------------------------------------------------------
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
    history: historyScreen,
    weight: weightScreen,
    backup: backupScreen,
  };
  const view = keeper.ok ? (views[screen] ?? notFound) : brokenScreen;
  app.replaceChildren(...[saveErrorBanner(), view()].flat(2).filter(Boolean));
  if (scroll) window.scrollTo(0, 0);
}

addEventListener('hashchange', () => render());
render();
