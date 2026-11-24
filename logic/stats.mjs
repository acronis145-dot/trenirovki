// Итог тренировки и прогресс по упражнениям — из записей, ничего не меняя.

import { EXERCISES } from '../data/program.mjs';

// Лучший подход: больше вес, при равном весе — больше повторов. Подходы без
// веса (бывают в старых записях) не сравниваются.
const better = (a, b) => (a.weightKg !== b.weightKg ? a.weightKg > b.weightKg : (a.reps ?? 0) > (b.reps ?? 0));

function best(sets) {
  let top = null;
  for (const s of sets) if (s.weightKg !== null && (top === null || better(s, top))) top = s;
  return top;
}

// Порядок тренировок во времени: дата, потом время первого подхода.
const firstAt = (w) => w.sets[0]?.at ?? '';
const byTime = (a, b) => a.date.localeCompare(b.date) || firstAt(a).localeCompare(firstAt(b));

// Поднято за подход, кг: у тренажёров с дисками вес записан с одной стороны.
const lifted = (s) => (s.weightKg ?? 0) * (EXERCISES[s.exercise]?.perSide ? 2 : 1) * (s.reps ?? 0);

// { minutes, sets, exercises, liftedKg, records: [{ exercise, now, before }] }
// records — упражнения, где лучший подход сегодня лучше всех прошлых; в
// первый раз упражнение рекордом не считается — сравнивать не с чем.
export function workoutSummary(store, workoutId) {
  const w = store.workouts.find((x) => x.id === workoutId);
  if (!w) throw new Error(`Нет тренировки ${workoutId}`);
  const times = w.sets.map((s) => Date.parse(s.at)).filter(Number.isFinite);
  const minutes = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60_000) : 0;
  const earlier = store.workouts.filter((x) => x.id !== w.id && byTime(x, w) < 0);
  const ids = [...new Set(w.sets.map((s) => s.exercise))];
  const records = [];
  for (const exercise of ids) {
    const now = best(w.sets.filter((s) => s.exercise === exercise));
    const before = best(earlier.flatMap((x) => x.sets.filter((s) => s.exercise === exercise)));
    if (now && before && better(now, before)) records.push({ exercise, now, before });
  }
  return {
    minutes,
    sets: w.sets.length,
    exercises: ids.length,
    liftedKg: Math.round(w.sets.reduce((n, s) => n + lifted(s), 0)),
    records,
  };
}

// Лучший подход упражнения в каждой тренировке, по времени:
// [{ date, weightKg, reps }].
export function exerciseProgress(store, exerciseId) {
  return [...store.workouts].sort(byTime).flatMap((w) => {
    const top = best(w.sets.filter((s) => s.exercise === exerciseId));
    return top ? [{ date: w.date, weightKg: top.weightKg, reps: top.reps }] : [];
  });
}

// Упражнения, которые хоть раз делались, — в порядке первого появления.
export const doneExercises = (store) => [...new Set([...store.workouts].sort(byTime).flatMap((w) => w.sets.map((s) => s.exercise)))];
