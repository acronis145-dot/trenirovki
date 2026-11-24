// Формат записей Евы — неприкосновенная зона (конституция 3.2, CLAUDE.md).
//
// Хранилище версии 1:
// {
//   schemaVersion: 1,
//   workouts: [{
//     id: строка,                 // уникальна
//     date: 'ГГГГ-ММ-ДД',         // день тренировки
//     session: 'A'|'B'|'C'|'I'|'II'|'ONE',
//     sets: [{ exercise: id упражнения, weightKg: число|null, reps: целое|null,
//              at: время записи ISO }],
//     finished: да/нет,
//   }],
//   bodyWeights: [{ date: 'ГГГГ-ММ-ДД', kg: число }],
// }
//
// Все функции чистые: возвращают новое хранилище и никогда не удаляют и не
// меняют уже записанное — только добавляют. Единственное исключение (Р-28):
// последний подход ещё не законченной тренировки можно отменить — это
// исправление ошибочного нажатия, а не история. Законченные тренировки
// неприкосновенны; любое другое удаление — отдельное решение Владислава.

import { SESSIONS, EXERCISES } from '../data/program.mjs';
import { weekStart } from './week.mjs';

export const SCHEMA_VERSION = 1;

export const emptyStore = () => ({ schemaVersion: SCHEMA_VERSION, workouts: [], bodyWeights: [] });

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

// Список проблем; пустой — хранилище в порядке.
export function validateStore(s) {
  const p = [];
  if (!s || typeof s !== 'object') return ['хранилище — не объект'];
  if (s.schemaVersion !== SCHEMA_VERSION) p.push(`версия ${s.schemaVersion}, ожидалась ${SCHEMA_VERSION}`);
  if (!Array.isArray(s.workouts)) p.push('нет списка тренировок');
  if (!Array.isArray(s.bodyWeights)) p.push('нет списка взвешиваний');
  if (p.length) return p;
  const ids = new Set();
  s.workouts.forEach((w, i) => {
    const at = `тренировка ${i + 1}`;
    if (typeof w.id !== 'string' || !w.id) p.push(`${at}: нет id`);
    else if (ids.has(w.id)) p.push(`${at}: повтор id ${w.id}`);
    ids.add(w.id);
    if (!DATE.test(w.date ?? '')) p.push(`${at}: дата ${w.date}`);
    if (!SESSIONS[w.session]) p.push(`${at}: неизвестная тренировка ${w.session}`);
    if (typeof w.finished !== 'boolean') p.push(`${at}: нет отметки «закончена»`);
    if (!Array.isArray(w.sets)) { p.push(`${at}: нет подходов`); return; }
    w.sets.forEach((x, j) => {
      const sat = `${at}, подход ${j + 1}`;
      if (!EXERCISES[x.exercise]) p.push(`${sat}: неизвестное упражнение ${x.exercise}`);
      if (x.weightKg !== null && !(isNum(x.weightKg) && x.weightKg >= 0)) p.push(`${sat}: вес ${x.weightKg}`);
      if (x.reps !== null && !(Number.isInteger(x.reps) && x.reps >= 0)) p.push(`${sat}: повторы ${x.reps}`);
      if (typeof x.at !== 'string') p.push(`${sat}: нет времени записи`);
    });
  });
  s.bodyWeights.forEach((b, i) => {
    if (!DATE.test(b.date ?? '')) p.push(`взвешивание ${i + 1}: дата ${b.date}`);
    if (!(isNum(b.kg) && b.kg > 0)) p.push(`взвешивание ${i + 1}: вес ${b.kg}`);
  });
  return p;
}

// Приводит прочитанное с телефона к текущей версии. Неизвестная (более новая)
// версия — ошибка, а не молчаливая потеря: такие данные не трогаем.
export function migrate(raw) {
  if (raw === null || raw === undefined) return emptyStore();
  if (raw.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Данные новее приложения (версия ${raw.schemaVersion}) — нужно обновить приложение, данные не тронуты`);
  }
  const problems = validateStore(raw);
  if (problems.length) throw new Error(`Данные повреждены, не тронуты: ${problems.join('; ')}`);
  return raw;
}

export function startWorkout(store, { id, date, session }) {
  if (!SESSIONS[session]) throw new Error(`Неизвестная тренировка ${session}`);
  if (store.workouts.some((w) => w.id === id)) throw new Error(`Тренировка ${id} уже есть`);
  const w = { id, date, session, sets: [], finished: false };
  return { ...store, workouts: [...store.workouts, w] };
}

const updateWorkout = (store, id, fn) => {
  if (!store.workouts.some((w) => w.id === id)) throw new Error(`Нет тренировки ${id}`);
  return { ...store, workouts: store.workouts.map((w) => (w.id === id ? fn(w) : w)) };
};

// Подход записывается сразу, как сделан (конституция 3.2).
export function recordSet(store, workoutId, { exercise, weightKg, reps, at }) {
  if (!EXERCISES[exercise]) throw new Error(`Неизвестное упражнение ${exercise}`);
  return updateWorkout(store, workoutId, (w) => ({ ...w, sets: [...w.sets, { exercise, weightKg, reps, at }] }));
}

// Отмена ошибочного «Сделано» (Р-28): только самый последний подход и только
// пока тренировка не закончена.
export function undoLastSet(store, workoutId) {
  return updateWorkout(store, workoutId, (w) => {
    if (w.finished) throw new Error(`Тренировка ${workoutId} закончена — её подходы не меняются`);
    if (w.sets.length === 0) throw new Error(`В тренировке ${workoutId} нечего отменять`);
    return { ...w, sets: w.sets.slice(0, -1) };
  });
}

export const finishWorkout = (store, workoutId) => updateWorkout(store, workoutId, (w) => ({ ...w, finished: true }));

// Идущая тренировка: последняя не законченная за этот день (и этой
// тренировки, если она указана). Нет такой — null.
export const activeWorkout = (store, date, session = null) => store.workouts
  .findLast((w) => !w.finished && w.date === date && (session === null || w.session === session)) ?? null;

export function recordBodyWeight(store, { date, kg }) {
  if (!DATE.test(date ?? '') || !(isNum(kg) && kg > 0)) throw new Error(`Взвешивание не записано: ${date}, ${kg}`);
  return { ...store, bodyWeights: [...store.bodyWeights, { date, kg }] };
}

// Средний вес тела по неделям: [{ week: понедельник, kg, count }], по порядку.
export function weeklyBodyWeight(store) {
  const by = new Map();
  for (const b of store.bodyWeights) {
    const k = weekStart(b.date);
    const e = by.get(k) ?? { sum: 0, count: 0 };
    by.set(k, { sum: e.sum + b.kg, count: e.count + 1 });
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([week, e]) => ({ week, kg: Math.round((e.sum / e.count) * 10) / 10, count: e.count }));
}

// Тренировки этой недели, в которых записан хотя бы один подход.
export const doneThisWeek = (store, date) => store.workouts
  .filter((w) => w.sets.length > 0 && weekStart(w.date) === weekStart(date))
  .sort((a, b) => a.date.localeCompare(b.date))
  .map((w) => w.session);
