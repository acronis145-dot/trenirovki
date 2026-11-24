// Итог тренировки, история, прогресс по упражнениям и вес тела.

import { SESSIONS, EXERCISES } from '../data/program.mjs';
import { recordBodyWeight, weeklyBodyWeight } from '../logic/records.mjs';
import { workoutSummary, exerciseProgress, doneExercises } from '../logic/stats.mjs';
import { setsOf } from '../logic/workout.mjs';
import { todayLocal } from '../logic/week.mjs';
import { state, commit, refresh } from './state.mjs';
import { h, topbar, num, fmtKg, fmtSet, fmtWeight, fmtDate, fmtShortDate, parseNum } from './dom.mjs';
import { lineChart } from './chart.mjs';

const stat = (value, label) => h('div', { class: 'stat' }, h('b', {}, value), h('span', { class: 'muted small' }, label));

// --- Итог тренировки ---------------------------------------------------------
export function summaryScreen(workoutId) {
  const w = state.store.workouts.find((x) => x.id === workoutId);
  if (!w) return null;
  const r = workoutSummary(state.store, workoutId);
  return [
    topbar(null, '#/history'),
    h('span', { class: 'eyebrow' }, fmtDate(w.date)),
    h('h1', {}, w.finished ? `${SESSIONS[w.session].title} — готово` : SESSIONS[w.session].title),
    h('div', { class: 'stats' },
      stat(r.sets > 1 ? `${r.minutes} мин` : '—', 'длилась'),
      stat(String(r.sets), 'подходов'),
      stat(`${num(r.liftedKg)} кг`, 'поднято всего')),
    r.records.length ? h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, 'Лучше, чем раньше'),
      h('ul', { class: 'pairs' }, r.records.map((x) => h('li', {},
        h('span', {}, EXERCISES[x.exercise].ru),
        h('span', { class: 'delta up' }, `${fmtSet(x.now)} ↑`))))) : null,
    h('div', { class: 'card' },
      h('div', { class: 'eyebrow' }, 'Подходы'),
      h('ul', { class: 'pairs' }, [...new Set(w.sets.map((s) => s.exercise))].map((id) => h('li', {},
        h('span', {}, EXERCISES[id].ru),
        h('span', { class: 'muted' }, setsOf(w, id).map(fmtSet).join(', ')))))),
    h('div', { class: 'action-bar' }, h('a', { class: 'primary', href: '#/' }, 'На главную')),
  ];
}

// --- История -----------------------------------------------------------------
export function historyScreen() {
  const workouts = state.store.workouts.filter((w) => w.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return [
    topbar('История', '#/'),
    workouts.length === 0 ? h('p', { class: 'muted' }, 'Здесь появятся тренировки, как только запишешь первый подход.') : null,
    h('div', { class: 'rows' }, workouts.map((w) => {
      const r = workoutSummary(state.store, w.id);
      return h('a', { class: 'row', href: `#/done/${w.id}` },
        h('span', {}, h('b', {}, SESSIONS[w.session].title), h('br'), h('span', { class: 'muted small' }, fmtDate(w.date))),
        h('span', { class: 'row-end' },
          w.finished ? null : h('span', { class: 'badge' }, 'Не закончена'),
          r.records.length ? h('span', { class: 'delta up' }, `↑ ${r.records.length}`) : null,
          h('span', { class: 'muted small' }, `${r.sets} подх.`)));
    })),
  ];
}

// --- Прогресс ----------------------------------------------------------------
const toPoints = (rows) => rows.map((p) => ({ label: fmtShortDate(p.date), value: p.weightKg }));

export function progressScreen() {
  const ids = doneExercises(state.store);
  const weeks = weeklyBodyWeight(state.store);
  return [
    topbar('Прогресс', '#/'),
    weeks.length ? h('a', { class: 'card link-card', href: '#/weight' },
      h('div', { class: 'eyebrow' }, 'Вес тела, средний за неделю'),
      h('b', { class: 'big' }, fmtKg(weeks.at(-1).kg)),
      lineChart(weeks.map((w) => ({ label: fmtShortDate(w.week), value: w.kg })), 'кг', { compact: true })) : null,
    ids.length === 0 ? h('p', { class: 'muted' }, 'Графики появятся после первой записанной тренировки.') : null,
    h('div', { class: 'rows' }, ids.map((id) => {
      const rows = exerciseProgress(state.store, id);
      if (!rows.length) return null; // подходы без веса — рисовать нечего
      const ex = EXERCISES[id];
      const first = rows[0].weightKg;
      const last = rows.at(-1).weightKg;
      const d = Math.round((last - first) * 100) / 100;
      return h('a', { class: 'row progress-row', href: `#/progress/${id}` },
        h('span', {}, h('b', {}, ex.ru), h('br'), h('span', { class: 'muted small' }, fmtWeight(ex, last))),
        rows.length > 1 ? lineChart(toPoints(rows), 'кг', { compact: true }) : h('span'),
        d > 0 ? h('span', { class: 'delta up' }, `↑ +${num(d)}`) : h('span', { class: 'muted small' }, rows.length > 1 ? 'без изменений' : 'первый раз'));
    })),
  ];
}

export function exerciseProgressScreen(id) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const rows = exerciseProgress(state.store, id);
  return [
    topbar(null, '#/progress'),
    h('h1', {}, ex.ru),
    h('p', { class: 'muted' }, ex.perSide ? 'Лучший подход каждой тренировки, кг с каждой стороны' : 'Лучший подход каждой тренировки, кг'),
    rows.length ? h('div', { class: 'card' }, lineChart(toPoints(rows), 'кг')) : h('p', { class: 'muted' }, 'Это упражнение ещё не записано.'),
    h('ul', { class: 'card pairs' }, [...rows].reverse().map((p) => h('li', {},
      h('span', {}, fmtDate(p.date)),
      h('span', {}, `${fmtWeight(ex, p.weightKg)} × ${p.reps ?? '—'}`)))),
  ];
}

// --- Вес тела ----------------------------------------------------------------
// Показывается средний за неделю, а не дневные скачки (Р-16).
let weightDraft = null;

export function weightScreen() {
  const weeks = weeklyBodyWeight(state.store);
  const save = h('button', {
    class: 'primary', type: 'button', disabled: !(weightDraft > 0),
    onclick: () => {
      if (!commit(recordBodyWeight(state.store, { date: todayLocal(), kg: weightDraft }))) return;
      weightDraft = null;
      refresh();
    },
  }, 'Записать');
  return [
    topbar('Вес тела', '#/'),
    h('div', { class: 'card steppers' },
      h('label', { class: 'stepper-mid' },
        h('span', { class: 'eyebrow' }, `Сегодня, ${fmtDate(todayLocal())}`),
        h('input', {
          class: 'big-value', type: 'text', inputmode: 'decimal', autocomplete: 'off',
          value: weightDraft === null ? '' : num(weightDraft), placeholder: '0,0', 'aria-label': 'Вес тела, кг',
          oninput: (ev) => { weightDraft = parseNum(ev.target.value); save.disabled = !(weightDraft > 0); },
        }),
        h('span', { class: 'unit' }, 'кг'))),
    h('p', { class: 'muted small' }, 'Вес скачет день ото дня из-за воды и еды, поэтому главное — средний за неделю.'),
    weeks.length > 1 ? h('div', { class: 'card' }, lineChart(weeks.map((w) => ({ label: fmtShortDate(w.week), value: w.kg })), 'кг')) : null,
    weeks.length ? h('ul', { class: 'card pairs' }, [...weeks].reverse().map((w) => h('li', {},
      h('span', {}, `с ${fmtDate(w.week)}`),
      h('span', {}, h('b', {}, fmtKg(w.kg)), h('span', { class: 'muted small' }, ` · взвешиваний: ${w.count}`))))) : null,
    h('div', { class: 'action-bar' }, save),
  ];
}
