// Общие помощники экранов: разметка, числа и даты по-русски, переходы.
// Тексты вставляются через textContent — никакой разметки из данных.

import { EXERCISES } from '../data/program.mjs';
import { weightText, estimateMinutes } from '../logic/plan.mjs';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  return fill(el, attrs, children);
}

// То же для графиков (SVG живёт в своём пространстве имён).
export function svg(tag, attrs = {}, ...children) {
  return fill(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, children);
}

function fill(el, attrs, children) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const num = (x) => String(x).replace('.', ',');
export const fmtKg = (kg) => `${num(kg)} кг`;
export const fmtWeight = (ex, kg) => (kg === null ? '—' : weightText(ex, kg));
export const fmtSet = (s) => `${fmtWeight(EXERCISES[s.exercise], s.weightKg)} × ${s.reps ?? '—'}`;
export const minutesText = (s) => `≈ ${Math.round(estimateMinutes(s) / 5) * 5} мин`;
export const ltName = (ex) => ex.lt ?? ex.ltNew;
export const go = (hash) => { location.hash = hash; };

const DAY = new Intl.DateTimeFormat('ru', { weekday: 'short', day: 'numeric', month: 'long' });
const SHORT = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
const local = (date) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const fmtDate = (date) => DAY.format(local(date));
export const fmtShortDate = (date) => SHORT.format(local(date));

// Ввод числа с телефона: запятая или точка; пусто или мусор — null.
export function parseNum(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// back — адрес экрана или функция (из карточки — «туда, откуда пришли»).
export function topbar(title, back, extra = null) {
  const onclick = typeof back === 'function' ? back : () => go(back);
  return h('header', { class: 'topbar' },
    back ? h('button', { class: 'back', type: 'button', onclick, 'aria-label': 'Назад' }, '‹ Назад') : null,
    title ? h('h2', {}, title) : null,
    extra ? h('span', { class: 'topbar-extra' }, extra) : null);
}

export const list = (items) => h('ul', {}, items.map((t) => h('li', {}, t)));
