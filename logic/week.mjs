// Даты и недели. Дата — строка «ГГГГ-ММ-ДД» по местному календарю Евы:
// так запись не уезжает на соседний день из-за часового пояса. Неделя — с
// понедельника по воскресенье (как в таблице «Какую сегодня»).

const DAY_MS = 86_400_000;

function toUtc(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Дата должна быть в виде ГГГГ-ММ-ДД, получено: ${date}`);
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (new Date(t).getUTCDate() !== +m[3]) throw new Error(`Такой даты нет: ${date}`);
  return t;
}

const fromUtc = (t) => new Date(t).toISOString().slice(0, 10);

export const addDays = (date, n) => fromUtc(toUtc(date) + n * DAY_MS);

export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

// Понедельник недели, в которую входит дата.
export function weekStart(date) {
  const t = toUtc(date);
  const weekday = (new Date(t).getUTCDay() + 6) % 7; // понедельник = 0
  return fromUtc(t - weekday * DAY_MS);
}

export const sameWeek = (a, b) => weekStart(a) === weekStart(b);

// Сегодняшняя дата по часам телефона.
export function todayLocal(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
