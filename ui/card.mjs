// Карточка упражнения: рисунок, как делать, ошибки, когда остановиться, видео.

import { EXERCISES, GROUPS } from '../data/program.mjs';
import { PICTURES, CREDITS, pictureSearchUrl } from '../data/pictures.mjs';
import { startText } from '../logic/plan.mjs';
import { h, go, topbar, ltName } from './dom.mjs';

// Начало и конец движения рядом (или один кадр, если законного второго
// нет). compact — маленький, на экране подхода: нажатие открывает карточку.
// Рисунки чёрные на белом — на тёмном экране лежат на светлой подложке,
// сами рисунки не меняем.
export function exercisePicture(id, { compact = false, href = null } = {}) {
  const p = PICTURES[id];
  const ex = EXERCISES[id];
  if (!p) {
    // Своего рисунка нет — ссылка на картинки этого упражнения в интернете.
    const search = pictureSearchUrl(id);
    return search ? h('a', { class: 'pic-search', href: search, target: '_blank', rel: 'noopener' },
      h('b', {}, 'Как выглядит — картинки в интернете ↗'),
      h('span', { class: 'muted small' }, 'Нужен интернет · своего рисунка пока нет')) : null;
  }
  const imgs = h('div', { class: p.files.length === 1 ? 'pic-pair single' : 'pic-pair' },
    p.files.map((src, i) => h('img', { src, alt: `${ex.ru}: ${p.phases[i]} движения`, loading: 'lazy', decoding: 'async' })));
  if (compact) return h('a', { class: 'pic compact', href, 'aria-label': `${ex.ru} — как делать` }, imgs);
  const credit = CREDITS[p.credit];
  const phases = p.phases.length === 1 ? `${p.phases[0]} движения` : p.phases.join(' → ');
  return h('figure', { class: 'pic' }, imgs,
    h('figcaption', {}, h('span', {}, phases[0].toUpperCase() + phases.slice(1)),
      credit.url ? h('a', { href: credit.url, target: '_blank', rel: 'noopener' }, credit.text) : h('span', {}, credit.text)));
}

export function exerciseScreen(id) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video)}`;
  const section = (title, ...body) => h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, title), ...body);
  return [
    topbar(null, () => (history.length > 1 ? history.back() : go('#/'))),
    h('h1', {}, ex.ru),
    h('p', { class: 'muted' }, `${ltName(ex)} · ${GROUPS[ex.group].name}`),
    exercisePicture(id),
    section('Как делать', h('ol', { class: 'cues' }, ex.cues.map((c) => h('li', {}, c)))),
    section('Частые ошибки', h('p', {}, ex.mistakes)),
    h('div', { class: 'card stop' }, h('div', { class: 'eyebrow' }, 'Когда остановиться'), h('p', {}, ex.stop)),
    ex.fallback ? section('Если тренажёра нет', h('p', {}, ex.fallback)) : null,
    section('Вес', h('p', {}, `Старт: ${startText(ex)}`), h('p', { class: 'muted small' }, `Последний у тренера: ${ex.last}`)),
    h('div', { class: 'action-bar' },
      h('a', { class: 'primary', href: video, target: '_blank', rel: 'noopener' }, 'Видео на YouTube'),
      h('p', { class: 'muted small center' }, 'Нужен интернет · откроется поиск, выбирай ролик тренера')),
  ];
}
