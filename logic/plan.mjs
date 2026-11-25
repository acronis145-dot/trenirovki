// План конкретной тренировки на сегодня: сколько подходов и какой вес
// предложить в каждом упражнении. Неприкосновенная зона: веса — безопасность
// Евы (конституция 2.7–2.9).
//
// - Вводный период — первые INTRO_DAYS дней с первой записанной тренировки:
//   вместо 3 подходов — 2, вес не растёт сам (только если Ева поменяет его).
// - Потом: если в прошлый раз во всех подходах сделано целевое число повторов,
//   вес растёт на шаг упражнения (правило 2.8). Иначе — тот же вес.
// - Приложение само вес никогда не снижает: в неделю с одной тренировкой
//   тяжесть сохраняется (поддержка формы держится на ней).

import { SESSIONS, EXERCISES, BACKUPS } from '../data/program.mjs';
import { daysBetween } from './week.mjs';

export const INTRO_DAYS = 14;

// Оценка длительности тренировки, минут: подход с отдыхом ≈ 2 минуты, в паре
// ≈ 1,7 (отдых один на двоих), разминка 10 и растяжка 8. Конституция 2.3:
// потолок 90.
export const estimateMinutes = (session) => 18 + session.items.reduce((m, it) => m + (it.pair
  ? 1.7 * (it.pair[0].sets + it.pair[1].sets) : 2 * it.sets), 0);

const fmtKg = (kg) => `${String(kg).replace('.', ',')} кг`;

// Как показать вес упражнения: у тренажёров с дисками — с одной стороны
// (perSide), иначе Ева запишет то сумму, то сторону.
export function weightText(ex, kg) {
  if (!ex.perSide) return fmtKg(kg);
  return kg === 0 ? 'без дисков' : `по ${fmtKg(kg)}`;
}

export const startText = (ex) => (ex.startKg === null ? 'подбор: самый лёгкий вес' : weightText(ex, ex.startKg));

export function inIntro(store, date) {
  const dates = store.workouts.filter((w) => w.sets.length > 0).map((w) => w.date).sort();
  return dates.length === 0 || daysBetween(dates[0], date) < INTRO_DAYS;
}

// Подходы этого упражнения в последней тренировке до даты, где оно было.
// currentId — идущая тренировка: её подходы не считаются «прошлым разом»,
// иначе вес вырос бы посреди тренировки после первого же подхода.
export function lastSets(store, exerciseId, date, currentId = null) {
  const past = store.workouts
    .filter((w) => w.id !== currentId && w.date <= date && w.sets.some((s) => s.exercise === exerciseId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const w = past.at(-1);
  return w ? w.sets.filter((s) => s.exercise === exerciseId) : [];
}

export function suggestWeight(store, exerciseId, targetReps, date, intro, currentId = null) {
  const ex = EXERCISES[exerciseId];
  const sets = lastSets(store, exerciseId, date, currentId).filter((s) => s.weightKg !== null);
  if (sets.length === 0) {
    return { weightKg: ex.startKg, reason: ex.startKg === null ? 'подбор: начни с самого лёгкого веса' : 'стартовый вес' };
  }
  const base = Math.max(...sets.map((s) => s.weightKg));
  const allDone = sets.every((s) => s.reps !== null && s.reps >= targetReps);
  if (!intro && allDone) {
    const next = Math.round((base + ex.step) * 100) / 100;
    return { weightKg: next, reason: `+${fmtKg(ex.step)}: в прошлый раз все подходы по ${targetReps}` };
  }
  return { weightKg: base, reason: 'как в прошлый раз' };
}

const idsOf = (session) => session.items.flatMap((it) => (it.pair ?? [it]).map((e) => e.id));

// Запасные упражнения для места exerciseId в этой тренировке (Р-40). Каждое
// запасное в тренировке может занять только одно место — иначе по записям
// не понять, вместо чего оно сделано. Поэтому: то, что в тренировке и так
// стоит, не предлагается; запасное, нужное двум местам, достаётся тому, у
// кого оно выше в списке, при равенстве — тому, что раньше в тренировке.
export function backupsFor(sessionId, exerciseId) {
  const ids = idsOf(SESSIONS[sessionId]);
  const rank = (main, b) => (BACKUPS[main] ?? []).indexOf(b);
  const mine = (b, other) => {
    const r = rank(other, b);
    return r < 0 || rank(exerciseId, b) < r || (rank(exerciseId, b) === r && ids.indexOf(exerciseId) < ids.indexOf(other));
  };
  return (BACKUPS[exerciseId] ?? []).filter((b) => !ids.includes(b) && ids.every((o) => o === exerciseId || mine(b, o)));
}

// [{ pair: да/нет, exercises: [{ id, sets, reps, weightKg, reason,
//    alternatives, replaces? }] }]
// currentId — id идущей тренировки (см. lastSets), если она уже начата.
// Замена: как только в идущей тренировке записан подход запасного, место
// занимает оно (replaces — чьё место), со своим весом и оставшимися
// подходами. Отмена этого подхода возвращает основное — отдельной отметки
// о замене в записях нет.
export function planSession(store, sessionId, date, currentId = null) {
  const s = SESSIONS[sessionId];
  if (!s) throw new Error(`Неизвестная тренировка ${sessionId}`);
  const intro = inIntro(store, date);
  const current = store.workouts.find((w) => w.id === currentId);
  const done = (id) => (current ? current.sets.filter((x) => x.exercise === id).length : 0);
  const one = (e) => {
    const reps = Number.parseInt(e.reps, 10);
    const sets = intro && e.sets === 3 ? 2 : e.sets;
    const make = (id, n) => ({ id, sets: n, reps, ...suggestWeight(store, id, reps, date, intro, currentId) });
    const left = Math.max(1, sets - done(e.id));
    const alternatives = backupsFor(sessionId, e.id).map((id) => make(id, left));
    const used = alternatives.find((a) => done(a.id) > 0);
    return used ? { ...used, replaces: e.id, alternatives: [] } : { ...make(e.id, sets), alternatives };
  };
  return {
    sessionId, title: s.title, intro,
    items: s.items.map((it) => ({ pair: Boolean(it.pair), exercises: (it.pair ?? [it]).map(one) })),
  };
}
