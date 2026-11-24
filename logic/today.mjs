// Какую тренировку делать сегодня (конституция 2.5).
// done — тренировки, уже сделанные на этой неделе; left — ответ Евы
// «сколько ещё раз успею на этой неделе, считая сегодня» (1, 2 или 3).
// Возвращает id тренировки или REST, если трёх в неделю уже достаточно.
//
// Порядок мысли: начало недели выбирает режим по ответу; дальше неделя
// достраивается так, чтобы к последней тренировке было закрыто всё тело.
// Таблица «Какую сегодня» для Евы печатается из этой же функции.

export const REST = 'REST';
const ABC = ['A', 'B', 'C'];
const MAX_PER_WEEK = 3;

const nextUndone = (done) => ABC.find((id) => !done.includes(id)) ?? REST;

export function pickSession(done, left) {
  if (done.length >= MAX_PER_WEEK) return REST;
  const n = Math.max(1, Math.min(3, Math.trunc(left)));
  if (done.length === 0) return n === 3 ? 'A' : n === 2 ? 'I' : 'ONE';
  // День А сделан, а окно осталось одно: II добирает всё, чего не было в А.
  if (done.length === 1 && done[0] === 'A' && n === 1) return 'II';
  // Начата неделя «I» или «Одна»: II её закрывает.
  if ((done.includes('I') || done.includes('ONE')) && !done.includes('II')) return 'II';
  return nextUndone(done);
}
