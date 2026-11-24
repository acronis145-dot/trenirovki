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

import { SESSIONS, EXERCISES } from '../data/program.mjs';
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

// [{ pair: да/нет, exercises: [{ id, sets, reps, weightKg, reason }] }]
// currentId — id идущей тренировки (см. lastSets), если она уже начата.
export function planSession(store, sessionId, date, currentId = null) {
  const s = SESSIONS[sessionId];
  if (!s) throw new Error(`Неизвестная тренировка ${sessionId}`);
  const intro = inIntro(store, date);
  const one = (e) => {
    const reps = Number.parseInt(e.reps, 10);
    return {
      id: e.id,
      sets: intro && e.sets === 3 ? 2 : e.sets,
      reps,
      ...suggestWeight(store, e.id, reps, date, intro, currentId),
    };
  };
  return {
    sessionId, title: s.title, intro,
    items: s.items.map((it) => ({ pair: Boolean(it.pair), exercises: (it.pair ?? [it]).map(one) })),
  };
}
