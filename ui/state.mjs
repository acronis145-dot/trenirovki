// Записи Евы на экранах: открытие памяти телефона и единственный путь
// изменить записи — commit(). Сначала запись в память; только если она
// удалась, экран идёт дальше. Не удалось — ошибка видна на любом экране, а
// нажатие не засчитано.

import { emptyStore } from '../logic/records.mjs';
import { openStorage } from '../logic/storage.mjs';

// Обращение к localStorage внутри функций: если Safari его запретит, ошибку
// поймает openStorage, а не загрузка страницы.
export const phone = {
  getItem: (k) => window.localStorage.getItem(k),
  setItem: (k, v) => window.localStorage.setItem(k, v),
};

export const keeper = openStorage(phone);

export const state = {
  store: keeper.ok ? keeper.store : emptyStore(),
  saveError: null,
};

// Перерисовать текущий экран, не прокручивая (задаёт main.mjs).
let rerender = () => {};
export const setRerender = (fn) => { rerender = fn; };
export const refresh = () => rerender();

export function commit(next) {
  try {
    keeper.save(next);
  } catch (e) {
    state.saveError = e.message;
    rerender();
    return false;
  }
  state.saveError = null;
  state.store = next;
  return true;
}
