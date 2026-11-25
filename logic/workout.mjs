// Ход идущей тренировки: сколько подходов сделано, что подставить в
// следующий, куда перейти после «Сделано». Решения о весах принимает
// plan.mjs; здесь — только порядок внутри тренировки.

export const setsOf = (workout, exerciseId) => (workout ? workout.sets.filter((s) => s.exercise === exerciseId) : []);

// Значения следующего подхода (конституция 3.3 — обычно хватает одного
// нажатия): как предыдущий подход сегодня; в первом подходе — вес из плана
// (он сам вырос из прошлого раза) и целевые повторы.
export function nextSetDefaults(workout, planned) {
  const prev = setsOf(workout, planned.id).at(-1);
  return prev ? { weightKg: prev.weightKg, reps: prev.reps } : { weightKg: planned.weightKg, reps: planned.reps };
}

// Куда после записанного подхода: в паре — к напарнику, пока у него остались
// подходы (пары делаются по очереди); иначе — ещё подход этого же
// упражнения; всё по плану сделано — null (назад к списку). skipped —
// пропущенные сегодня (тренажёр занят или сломан): к ним не ведём.
export function nextExercise(plan, workout, exerciseId, skipped = new Set()) {
  const item = plan.items.find((it) => it.exercises.some((e) => e.id === exerciseId));
  if (!item) throw new Error(`Упражнения ${exerciseId} нет в тренировке ${plan.sessionId}`);
  const left = (e) => setsOf(workout, e.id).length < e.sets;
  const self = item.exercises.find((e) => e.id === exerciseId);
  const partner = item.exercises.find((e) => e.id !== exerciseId);
  if (partner && left(partner) && !skipped.has(partner.id)) return partner.id;
  return left(self) ? self.id : null;
}

// Куда после «Пропустить»: следующее по порядку упражнение, где остались
// подходы и которое не пропущено; дальше по списку ничего нет — null.
export function afterSkip(plan, workout, exerciseId, skipped = new Set()) {
  const all = plan.items.flatMap((it) => it.exercises);
  const from = all.findIndex((e) => e.id === exerciseId);
  if (from < 0) throw new Error(`Упражнения ${exerciseId} нет в тренировке ${plan.sessionId}`);
  const next = all.slice(from + 1).find((e) => !skipped.has(e.id) && setsOf(workout, e.id).length < e.sets);
  return next?.id ?? null;
}
