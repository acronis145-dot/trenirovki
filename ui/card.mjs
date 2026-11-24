// Карточка упражнения: как делать, ошибки, когда остановиться, видео.

import { EXERCISES, GROUPS } from '../data/program.mjs';
import { startText } from '../logic/plan.mjs';
import { h, go, topbar, ltName } from './dom.mjs';

export function exerciseScreen(id) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.video)}`;
  const section = (title, ...body) => h('div', { class: 'card' }, h('div', { class: 'eyebrow' }, title), ...body);
  return [
    topbar(null, () => (history.length > 1 ? history.back() : go('#/'))),
    h('h1', {}, ex.ru),
    h('p', { class: 'muted' }, `${ltName(ex)} · ${GROUPS[ex.group].name}`),
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
