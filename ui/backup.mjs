// Копия записей и экран «не могу прочитать записи».

import { backupFile, lastBackupDate, markBackup } from '../logic/storage.mjs';
import { readBackup, mergeBackup } from '../logic/restore.mjs';
import { todayLocal } from '../logic/week.mjs';
import { state, keeper, phone, refresh, commit } from './state.mjs';
import { h, topbar, fmtDate } from './dom.mjs';

// На iPhone — меню «Поделиться» (сохранить в «Файлы», отправить в
// мессенджер); где его нет — обычное скачивание. Отказ Евы в меню (отмена)
// — не ошибка. Возвращает true, если файл отдан.
async function giveFile(name, text) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

// --- Восстановление из файла -------------------------------------------------
// Два шага: выбрать файл → увидеть, что добавится → подтвердить. Копия
// добавляется к записям телефона, ничего из телефона не удаляется
// (logic/restore.mjs).
let restore = null; // { name, incoming } | { error }

function pickFile() {
  const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      restore = { name: file.name, incoming: readBackup(await file.text()) };
    } catch (e) {
      restore = { error: e.message };
    }
    refresh();
    document.querySelector('.restore, .restore-error')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  document.body.append(input);
  input.click();
}

const count = (s) => `тренировок ${s.workouts.filter((w) => w.sets.length).length}, взвешиваний ${s.bodyWeights.length}`;

function restoreBlock() {
  if (!restore) {
    return h('button', { class: 'secondary', type: 'button', onclick: pickFile }, 'Восстановить из файла');
  }
  if (restore.error) {
    return h('div', { class: 'card restore-error' },
      h('p', { class: 'banner error' }, restore.error),
      h('button', { class: 'link-button', type: 'button', onclick: () => { restore = null; refresh(); } }, 'Понятно'));
  }
  let r;
  try {
    r = mergeBackup(state.store, restore.incoming);
  } catch (e) {
    restore = { error: e.message };
    return restoreBlock();
  }
  const nothing = r.added.workouts + r.added.sets + r.added.bodyWeights === 0;
  const cancel = h('button', { class: 'link-button', type: 'button', onclick: () => { restore = null; refresh(); } }, nothing ? 'Понятно' : 'Отмена');
  return h('div', { class: 'card restore' },
    h('div', { class: 'eyebrow' }, 'Файл копии'),
    h('p', {}, restore.name),
    h('p', { class: 'muted small' }, `В файле: ${count(restore.incoming)}.`),
    nothing
      ? h('p', {}, 'Всё из этого файла уже есть в телефоне.')
      : h('p', {}, `Добавится: тренировок ${r.added.workouts}, подходов ${r.added.sets}, взвешиваний ${r.added.bodyWeights}. Из телефона ничего не удаляется.`),
    r.conflicts.length ? h('p', { class: 'muted small' }, `Тренировок, которые в файле и в телефоне записаны по-разному: ${r.conflicts.length} — остаются как в телефоне.`) : null,
    nothing ? null : h('button', {
      class: 'primary', type: 'button',
      onclick: () => {
        if (!commit(mergeBackup(state.store, restore.incoming).store)) return;
        restore = null;
        refresh();
      },
    }, 'Добавить в телефон'),
    cancel);
}

export function backupScreen() {
  const { store } = state;
  const last = lastBackupDate(phone);
  const status = h('p', { class: 'muted small', role: 'status' });
  const button = h('button', {
    class: 'primary', type: 'button',
    onclick: async () => {
      const today = todayLocal();
      const { name, text } = backupFile(store, today);
      try {
        if (!(await giveFile(name, text))) return;
      } catch (e) {
        status.textContent = `Копия не сохранилась: ${e.message}`;
        return;
      }
      markBackup(phone, today);
      refresh();
    },
  }, 'Сохранить копию');
  return [
    topbar('Копия записей', '#/'),
    h('p', {}, 'Записи хранятся только в этом телефоне. Раз в неделю сохраняй копию: в «Файлы» или отправь Владиславу — тогда ничего не потеряется, даже если с телефоном что-то случится.'),
    h('ul', { class: 'card pairs' },
      h('li', {}, h('span', {}, 'Тренировок'), h('b', {}, store.workouts.filter((w) => w.sets.length > 0).length)),
      h('li', {}, h('span', {}, 'Подходов'), h('b', {}, store.workouts.reduce((n, w) => n + w.sets.length, 0))),
      h('li', {}, h('span', {}, 'Взвешиваний'), h('b', {}, store.bodyWeights.length)),
      h('li', {}, h('span', {}, 'Последняя копия'), h('b', {}, last ? fmtDate(last) : 'ещё не было'))),
    status,
    h('div', { class: 'eyebrow' }, 'Новый телефон или пропали записи'),
    h('p', { class: 'muted small' }, 'Выбери сохранённый файл копии — записи из него добавятся к тем, что в телефоне.'),
    restoreBlock(),
    // Пока решается восстановление, вторая крупная кнопка только мешает.
    restore ? null : h('div', { class: 'action-bar' }, button),
  ];
}

// Записи не прочитались: приложение ничего не пишет, только отдаёт то, что
// лежит в памяти, — чтобы Владислав разобрался и ничего не пропало.
export function brokenScreen() {
  const status = h('p', { class: 'muted small', role: 'status' });
  return [
    h('h1', {}, 'Не могу прочитать записи'),
    h('p', { class: 'banner error' }, keeper.error),
    h('p', {}, 'Записи в телефоне не стёрты и не изменены. Не удаляй приложение и не чисти данные Safari. Сохрани то, что лежит в памяти, и отправь Владиславу.'),
    status,
    keeper.raw === null ? null : h('div', { class: 'action-bar' }, h('button', {
      class: 'primary', type: 'button',
      onclick: async () => {
        try {
          await giveFile(`trenirovki-ne-prochitano-${todayLocal()}.json`, keeper.raw);
        } catch (e) {
          status.textContent = `Не получилось: ${e.message}`;
        }
      },
    }, 'Сохранить то, что в памяти')),
  ];
}
