// Отдых между подходами (правила программы: 1–1,5 минуты; в паре — после
// второго упражнения). Только расчёт: показывает таймер экран.

import { nextExercise } from './workout.mjs';

export const REST_SECONDS = 90;

// Сколько отдыхать после только что записанного подхода. Без отдыха —
// только переход от первого упражнения пары ко второму; после второго, после
// одиночного и перед следующим упражнением — REST_SECONDS.
export function restAfter(plan, workout, exerciseId) {
  const item = plan.items.find((it) => it.exercises.some((e) => e.id === exerciseId));
  const [first, second] = item?.exercises ?? [];
  const toPartner = second && exerciseId === first.id && nextExercise(plan, workout, exerciseId) === second.id;
  return toPartner ? 0 : REST_SECONDS;
}

// Осталось секунд до конца отдыха (не меньше нуля).
export const restLeft = (endsAt, now) => Math.max(0, Math.ceil((endsAt - now) / 1000));

// «1:05»
export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
