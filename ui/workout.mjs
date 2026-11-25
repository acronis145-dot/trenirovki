// Экраны тренировки: список упражнений и подход (вес, повторы, «Сделано»),
// таймер отдыха, отмена последнего подхода (Р-28), замена или пропуск
// упражнения, если тренажёр занят или сломан (Р-40), окончание тренировки.

import { SESSIONS, EXERCISES, WARMUP, COOLDOWN, RULES } from '../data/program.mjs';
import { planSession, lastSets } from '../logic/plan.mjs';
import { startWorkout, recordSet, undoLastSet, finishWorkout, activeWorkout } from '../logic/records.mjs';
import { nextSetDefaults, nextExercise, afterSkip, setsOf } from '../logic/workout.mjs';
import { restAfter, restLeft, clock } from '../logic/rest.mjs';
import { todayLocal } from '../logic/week.mjs';
import { state, commit, phone, refresh } from './state.mjs';
import { h, go, topbar, list, num, fmtSet, fmtWeight, minutesText, parseNum } from './dom.mjs';
import { exercisePicture } from './card.mjs';

// --- Отдых -----------------------------------------------------------------
// Конец отдыха — время на часах, а не счётчик: таймер верен и после того,
// как телефон погасил экран или Ева переключилась в другое приложение.
// Хранится отдельно от записей: это подсказка, сбой здесь ничего не ломает.
const REST_KEY = 'eva-trainings.rest';
const loadRest = () => {
  try { return Number(phone.getItem(REST_KEY)) || 0; } catch { return 0; }
};
const saveRest = (endsAt) => {
  try { phone.setItem(REST_KEY, String(endsAt)); } catch { /* подсказка не сохранилась */ }
};
let restEndsAt = loadRest();
const setRest = (endsAt) => { restEndsAt = endsAt; saveRest(endsAt); };

function restStrip() {
  if (!restEndsAt) return null;
  const el = h('div', { class: 'rest', 'data-rest': '' },
    h('span', { class: 'rest-label' }),
    h('span', { class: 'rest-clock', role: 'timer' }),
    h('button', { class: 'chip', type: 'button', onclick: () => { setRest(Math.max(restEndsAt, Date.now()) + 30_000); tick(); } }, '+30 с'),
    h('button', { class: 'chip', type: 'button', onclick: () => { setRest(0); refresh(); } }, 'Скрыть'));
  showRest(el);
  return el;
}

function showRest(el) {
  const left = restLeft(restEndsAt, Date.now());
  el.classList.toggle('over', left === 0);
  el.querySelector('.rest-clock').textContent = left === 0 ? 'Можно' : clock(left);
  el.querySelector('.rest-label').textContent = left === 0 ? 'Отдых окончен' : 'Отдых';
}

// Раз в полсекунды обновляем только цифры таймера, не перерисовывая экран
// (иначе сбивался бы ввод веса с клавиатуры).
const tick = () => document.querySelectorAll('[data-rest]').forEach(showRest);
setInterval(tick, 500);

// --- Пропущенные сегодня ---------------------------------------------------
// Упражнения, пропущенные в этой тренировке, — подсказка для порядка
// переходов, а не запись: хранится отдельно и только на сегодняшнюю
// тренировку; сбой здесь ничего не ломает (в худшем случае приложение ещё
// раз предложит пропущенное).
const SKIP_KEY = 'eva-trainings.skip';
const skipKey = (date, sessionId) => `${date}:${sessionId}`;
function skippedToday(date, sessionId) {
  try {
    const v = JSON.parse(phone.getItem(SKIP_KEY) ?? 'null');
    return new Set(v?.key === skipKey(date, sessionId) && Array.isArray(v.ids) ? v.ids : []);
  } catch { return new Set(); }
}
function saveSkipped(date, sessionId, ids) {
  try { phone.setItem(SKIP_KEY, JSON.stringify({ key: skipKey(date, sessionId), ids: [...ids] })); } catch { /* подсказка не сохранилась */ }
}

// Экран не гаснет, пока открыта тренировка. Safari может отказать — тогда
// экран гаснет как обычно, на записи это не влияет.
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock?.request('screen');
      wakeLock?.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// --- Общие части -----------------------------------------------------------
// Сколько идёт тренировка — с первого подхода.
const elapsedText = (workout) => {
  const first = workout?.sets[0]?.at;
  if (!first) return null;
  const min = Math.floor((Date.now() - Date.parse(first)) / 60_000);
  return `${min} мин`;
};

// Полоса из отрезков: один отрезок — одно упражнение.
function segments(plan, workout) {
  const all = plan.items.flatMap((it) => it.exercises);
  return h('div', { class: 'segments', 'aria-hidden': 'true' }, all.map((e) => {
    const done = setsOf(workout, e.id).length;
    return h('i', { class: done >= e.sets ? 'full' : done > 0 ? 'part' : '' });
  }));
}

// Последний записанный подход идущей тренировки и его отмена (Р-28).
function undoLine(workout) {
  const last = workout && !workout.finished ? workout.sets.at(-1) : null;
  if (!last) return null;
  return h('div', { class: 'undo' },
    h('span', {}, h('span', { class: 'muted' }, 'Записано: '), `${EXERCISES[last.exercise].ru}, ${fmtSet(last)}`),
    h('button', {
      class: 'link-button', type: 'button',
      onclick: () => { if (commit(undoLastSet(state.store, workout.id))) { setRest(0); refresh(); } },
    }, 'Отменить'));
}

// --- Экран: тренировка -----------------------------------------------------
function exerciseRow(sessionId, e, workout, skipped) {
  const ex = EXERCISES[e.id];
  const today = setsOf(workout, e.id);
  const done = today.length;
  const complete = done >= e.sets;
  const skip = !done && skipped.has(e.id);
  const kg = today.at(-1)?.weightKg ?? e.weightKg;
  const status = skip ? 'пропущено сегодня' : done > 0 ? `${complete ? '✓ ' : ''}сделано ${done} из ${e.sets}` : e.reason;
  return h('button', {
    class: `exercise${complete ? ' complete' : done ? ' started' : skip ? ' skipped' : ''}`, type: 'button', onclick: () => go(`#/w/${sessionId}/${e.id}`),
  },
  h('span', { class: 'name' }, ex.ru),
  h('span', { class: 'dose' }, h('b', {}, `${e.sets} × ${e.reps}`), h('span', {}, kg === null ? 'подбор' : fmtWeight(ex, kg))),
  h('span', { class: 'reason' }, e.replaces ? `${status} · вместо: ${EXERCISES[e.replaces].ru}` : status));
}

// Закончить — в два нажатия: после этого подходы уже не отменить (Р-28), а
// случайное касание в зале — обычное дело.
function finishButton(workout) {
  let armed = false;
  const btn = h('button', {
    class: 'secondary', type: 'button',
    onclick: () => {
      if (!armed) { armed = true; btn.textContent = 'Точно закончить? Нажми ещё раз'; return; }
      if (commit(finishWorkout(state.store, workout.id))) { setRest(0); go(`#/done/${workout.id}`); }
    },
  }, 'Закончить тренировку');
  return btn;
}

export function workoutScreen(id) {
  const s = SESSIONS[id];
  if (!s) return null;
  const today = todayLocal();
  const workout = activeWorkout(state.store, today, id);
  const plan = planSession(state.store, id, today, workout?.id);
  const skipped = skippedToday(today, id);
  return [
    topbar(null, '#/', elapsedText(workout) ?? minutesText(s)),
    h('h1', {}, s.title),
    segments(plan, workout),
    plan.intro ? h('span', { class: 'badge' }, 'Первые 2 недели: меньше подходов, вес сам не растёт') : null,
    restStrip(),
    h('details', { class: 'card fold' }, h('summary', {}, 'Разминка · ≈ 10 мин'), list(WARMUP)),
    h('ul', { class: 'exercise-list' }, plan.items.map((it) => h('li', {},
      it.pair
        ? h('div', { class: 'pair' }, h('span', { class: 'eyebrow' }, 'Пара — по очереди, отдых после второго'), it.exercises.map((e) => exerciseRow(id, e, workout, skipped)))
        : exerciseRow(id, it.exercises[0], workout, skipped)))),
    h('details', { class: 'card fold' }, h('summary', {}, 'Растяжка · ≈ 8 мин'), list(COOLDOWN)),
    h('details', { class: 'card fold' }, h('summary', {}, 'Правила'), list(RULES)),
    // Не прилипает к низу: список упражнений важнее, а закончить — один раз в конце.
    workout && workout.sets.length > 0 ? h('div', { class: 'finish' }, undoLine(workout), finishButton(workout)) : null,
  ];
}

// --- Экран: подход ---------------------------------------------------------
// Черновик значений: живёт, пока Ева не нажала «Сделано» или не ушла к
// другому подходу.
let draft = null;

function stepper(label, unit, value, { step, min, decimal, onchange }) {
  const input = h('input', {
    class: 'big-value', type: 'text', inputmode: decimal ? 'decimal' : 'numeric',
    value: value === null ? '' : num(value), 'aria-label': label, autocomplete: 'off', placeholder: '—',
    oninput: (ev) => onchange(parseNum(ev.target.value), false),
  });
  const shift = (d) => {
    const base = value ?? (d > 0 ? 0 : min);
    onchange(Math.max(min, Math.round((base + d) * 100) / 100), true);
  };
  return h('div', { class: decimal ? 'stepper' : 'stepper reps' },
    h('button', { class: 'step', type: 'button', 'aria-label': `${label}: меньше`, onclick: () => shift(-step) }, '−'),
    h('label', { class: 'stepper-mid' }, input, h('span', { class: 'unit' }, unit)),
    h('button', { class: 'step', type: 'button', 'aria-label': `${label}: больше`, onclick: () => shift(step) }, '+'));
}

const validSet = (d) => d.weightKg !== null && d.weightKg >= 0 && Number.isInteger(d.reps) && d.reps >= 1;

// Рост к прошлому разу — зелёным: видно, что сегодня больше.
function deltaBadge(previous, kg) {
  if (!previous.length || kg === null) return null;
  const top = Math.max(...previous.map((s) => s.weightKg ?? 0));
  if (kg === top) return null;
  const d = Math.round((kg - top) * 100) / 100;
  return h('span', { class: d > 0 ? 'delta up' : 'delta' }, `${d > 0 ? '↑ +' : '↓ '}${num(Math.abs(d))}`);
}

// Тренажёр занят или сломан: запасные на это место и «пропустить». Запасное
// займёт место с первым же записанным подходом (planSession).
function swapSection(sessionId, plan, workout, slot, today) {
  const skip = h('button', {
    class: 'row', type: 'button',
    onclick: () => {
      const skipped = skippedToday(today, sessionId).add(slot.id);
      saveSkipped(today, sessionId, skipped);
      const next = afterSkip(plan, workout, slot.id, skipped);
      go(next ? `#/w/${sessionId}/${next}` : `#/w/${sessionId}`);
    },
  }, h('span', {}, h('b', {}, 'Пропустить сегодня'), h('br'), h('span', { class: 'muted small' }, 'Перейти к следующему упражнению')));
  return h('details', { class: 'card fold swap' },
    h('summary', {}, 'Тренажёр занят или сломан'),
    h('div', { class: 'rows' },
      slot.alternatives.map((a) => h('a', { class: 'row', href: `#/w/${sessionId}/${a.id}` },
        h('span', {}, h('b', {}, EXERCISES[a.id].ru), h('br'), h('span', { class: 'muted small' }, a.reason)),
        h('span', { class: 'row-end' }, `${a.sets} × ${a.reps}`))),
      skip));
}

export function setScreen(sessionId, exerciseId) {
  const ex = EXERCISES[exerciseId];
  if (!SESSIONS[sessionId] || !ex) return null;
  const today = todayLocal();
  const workout = activeWorkout(state.store, today, sessionId);
  const plan = planSession(state.store, sessionId, today, workout?.id);
  // Место в тренировке: само упражнение или то, чьим запасным оно открыто.
  const items = plan.items.flatMap((it) => it.exercises);
  const slot = items.find((e) => e.id === exerciseId) ?? items.find((e) => e.alternatives.some((a) => a.id === exerciseId));
  if (!slot) return null;
  const planned = slot.id === exerciseId ? slot : slot.alternatives.find((a) => a.id === exerciseId);
  const instead = planned === slot ? slot.replaces : slot.id;

  const doneSets = setsOf(workout, exerciseId);
  const key = `${workout?.id ?? 'new'}:${exerciseId}:${doneSets.length}`;
  if (draft?.key !== key) draft = { key, ...nextSetDefaults(workout, planned) };
  const complete = doneSets.length >= planned.sets;
  const previous = lastSets(state.store, exerciseId, today, workout?.id);

  const doneButton = h('button', {
    class: complete ? 'secondary' : 'primary', type: 'button', disabled: !validSet(draft),
    onclick: () => {
      let s = state.store;
      let w = workout;
      if (!w) {
        w = { id: `${today}-${Date.now().toString(36)}` };
        s = startWorkout(s, { id: w.id, date: today, session: sessionId });
      }
      s = recordSet(s, w.id, { exercise: exerciseId, weightKg: draft.weightKg, reps: draft.reps, at: new Date().toISOString() });
      if (!commit(s)) return;
      const skipped = skippedToday(today, sessionId);
      if (skipped.delete(exerciseId)) saveSkipped(today, sessionId, skipped);
      const after = activeWorkout(state.store, today, sessionId);
      // План заново: первый подход запасного делает его хозяином места.
      const planAfter = planSession(state.store, sessionId, today, after.id);
      const rest = restAfter(planAfter, after, exerciseId, skipped);
      setRest(rest ? Date.now() + rest * 1000 : 0);
      const next = nextExercise(planAfter, after, exerciseId, skipped);
      if (next === exerciseId) refresh();
      else go(next ? `#/w/${sessionId}/${next}` : `#/w/${sessionId}`);
    },
  }, complete ? 'Записать ещё подход' : 'Сделано');

  const update = (field) => (value, rerender) => {
    draft[field] = value;
    if (rerender) refresh();
    else doneButton.disabled = !validSet(draft);
  };

  return [
    topbar(null, `#/w/${sessionId}`, elapsedText(workout)),
    segments(plan, workout),
    h('h1', {}, ex.ru),
    instead ? h('p', { class: 'muted' }, `Вместо: ${EXERCISES[instead].ru}`) : null,
    exercisePicture(exerciseId, { compact: true, href: `#/x/${exerciseId}` }),
    h('p', { class: 'muted' }, complete
      ? `Все ${planned.sets} подхода по плану сделаны`
      : `Подход ${doneSets.length + 1} из ${planned.sets} · цель ${planned.reps} повторов`),
    h('div', { class: 'card steppers' },
      stepper(ex.perSide ? 'Диски с каждой стороны' : 'Вес', ex.perSide ? 'кг с каждой стороны' : 'кг', draft.weightKg,
        { step: ex.step, min: 0, decimal: true, onchange: update('weightKg') }),
      stepper('Повторы', 'повторов', draft.reps, { step: 1, min: 1, decimal: false, onchange: update('reps') }),
      draft.weightKg === null ? h('p', { class: 'muted small' }, 'Подбор: начни с самого лёгкого веса и запиши, какой взяла.') : null),
    h('div', { class: 'card last' },
      h('span', { class: 'muted' }, previous.length ? `Прошлый раз: ${previous.map(fmtSet).join(', ')}` : planned.reason),
      deltaBadge(previous, draft.weightKg)),
    restStrip(),
    doneSets.length ? h('div', { class: 'chips' }, h('span', { class: 'eyebrow' }, 'Сегодня'),
      doneSets.map((x) => h('span', { class: 'chip static' }, fmtSet(x)))) : null,
    h('button', { class: 'link-button', type: 'button', onclick: () => go(`#/x/${exerciseId}`) }, 'Как делать'),
    planned === slot && !complete ? swapSection(sessionId, plan, workout, slot, today) : null,
    h('div', { class: 'action-bar' },
      undoLine(workout),
      complete ? h('a', { class: 'primary', href: `#/w/${sessionId}` }, 'К списку упражнений') : null,
      doneButton),
  ];
}
