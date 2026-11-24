// Восстановление из файла копии — неприкосновенная зона (конституция 3.2).
//
// Копия ДОБАВЛЯЕТСЯ к записям в телефоне, а не заменяет их: из телефона
// ничего не пропадает ни при каком файле. Правила слияния:
// - тренировка, которой в телефоне нет, — добавляется;
// - та же тренировка (тот же id): если одна версия — начало другой (те же
//   подходы, у другой — ещё), берётся более полная; если различаются иначе —
//   остаётся версия телефона, а расхождение сообщается;
// - взвешивание добавляется, если в телефоне нет такого же (дата и вес).
// Повторная загрузка того же файла ничего не меняет.

import { migrate, validateStore } from './records.mjs';

const sameSet = (a, b) => a.exercise === b.exercise && a.weightKg === b.weightKg && a.reps === b.reps && a.at === b.at;
const isPrefix = (short, long) => short.length <= long.length && short.every((s, i) => sameSet(s, long[i]));

// Текст файла → записи. Ошибка — если файл не копия или повреждён (та же
// проверка, что при открытии приложения).
export function readBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Это не файл копии записей: не читается как данные.');
  }
  if (raw === null || typeof raw !== 'object') throw new Error('Это не файл копии записей.');
  return migrate(raw);
}

// → { store, added: { workouts, sets, bodyWeights }, conflicts: [id] }
export function mergeBackup(current, incoming) {
  const workouts = [...current.workouts];
  const index = new Map(workouts.map((w, i) => [w.id, i]));
  const added = { workouts: 0, sets: 0, bodyWeights: 0 };
  const conflicts = [];

  for (const w of incoming.workouts) {
    const i = index.get(w.id);
    if (i === undefined) {
      index.set(w.id, workouts.length);
      workouts.push(w);
      added.workouts += 1;
      added.sets += w.sets.length;
      continue;
    }
    const mine = workouts[i];
    if (isPrefix(w.sets, mine.sets)) {
      if (w.finished && !mine.finished) workouts[i] = { ...mine, finished: true };
    } else if (isPrefix(mine.sets, w.sets)) {
      added.sets += w.sets.length - mine.sets.length;
      workouts[i] = { ...w, finished: w.finished || mine.finished };
    } else {
      conflicts.push(w.id);
    }
  }

  const bodyWeights = [...current.bodyWeights];
  for (const b of incoming.bodyWeights) {
    if (!bodyWeights.some((x) => x.date === b.date && x.kg === b.kg)) {
      bodyWeights.push(b);
      added.bodyWeights += 1;
    }
  }

  const store = { ...current, workouts, bodyWeights };
  const problems = validateStore(store);
  if (problems.length) throw new Error(`Копия не добавлена — получилась запись с ошибкой: ${problems.join('; ')}`);
  return { store, added, conflicts };
}
