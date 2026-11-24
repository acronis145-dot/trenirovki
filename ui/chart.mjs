// Линейный график без библиотек: точки по времени, подписи — первая и
// последняя дата, наименьшее и наибольшее значение. points: [{ label, value }].

import { svg, num } from './dom.mjs';

const W = 320;
const H = 150;
const PAD = { top: 14, right: 14, bottom: 22, left: 40 };

export function lineChart(points, unit, { compact = false } = {}) {
  const height = compact ? 48 : H;
  const pad = compact ? { top: 6, right: 6, bottom: 6, left: 6 } : PAD;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Все значения равны — шкала ±1 вокруг них, линия посередине.
  const lo = min === max ? min - 1 : min;
  const hi = min === max ? max + 1 : max;
  const x = (i) => pad.left + (points.length === 1 ? (W - pad.left - pad.right) / 2 : (i * (W - pad.left - pad.right)) / (points.length - 1));
  const y = (v) => pad.top + ((hi - v) * (height - pad.top - pad.bottom)) / (hi - lo);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const label = `${points.length} точек: от ${num(values[0])} до ${num(values.at(-1))} ${unit}`;
  return svg('svg', { class: compact ? 'chart compact' : 'chart', viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label },
    compact ? null : [
      [...new Set([max, min])].map((v) => [
        svg('line', { class: 'grid', x1: pad.left, x2: W - pad.right, y1: y(v), y2: y(v) }),
        svg('text', { class: 'axis', x: pad.left - 6, y: y(v) + 4, 'text-anchor': 'end' }, num(v)),
      ]),
      svg('text', { class: 'axis', x: pad.left, y: height - 4 }, points[0].label),
      points.length > 1 ? svg('text', { class: 'axis', x: W - pad.right, y: height - 4, 'text-anchor': 'end' }, points.at(-1).label) : null,
    ],
    points.length > 1 ? svg('polyline', { class: 'line', points: line }) : null,
    points.map((p, i) => svg('circle', { class: 'dot', cx: x(i), cy: y(p.value), r: compact ? 7 : 4 })));
}
