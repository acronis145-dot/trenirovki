// Хранение записей Евы в памяти телефона — неприкосновенная зона
// (конституция 3.2, CLAUDE.md).
//
// Где: localStorage браузера, одна строка JSON под одним ключом. Запись
// синхронная: когда «Сделано» отработало, подход уже в памяти телефона.
// Каждая запись заменяет строку целиком — браузер делает это атомарно:
// либо новая версия, либо старая, половинок не бывает.
//
// Правила:
// - прочитать не удалось (повреждено, версия новее приложения, память
//   недоступна) — приложение ничего не пишет: открывается только экран
//   ошибки с выгрузкой того, что лежит в памяти;
// - запись с ошибкой в данных не сохраняется;
// - если строку за это время изменило другое окно приложения — не
//   перезаписываем его работу, а просим открыть приложение заново;
// - после записи читаем обратно и сверяем.
//
// backend — { getItem(key), setItem(key, value) }: в браузере это
// localStorage, в проверках — подделка с нужными сбоями.

import { emptyStore, migrate, validateStore } from './records.mjs';

export const STORAGE_KEY = 'eva-trainings';
const BACKUP_KEY = `${STORAGE_KEY}.lastBackup`;

// { ok: true, store, save(next) } или { ok: false, error, raw } — raw: что
// лежит в памяти (null, если и прочитать не удалось).
export function openStorage(backend, key = STORAGE_KEY) {
  let text;
  try {
    text = backend.getItem(key);
  } catch (e) {
    return { ok: false, error: `Память телефона недоступна: ${e.message}`, raw: null };
  }
  let store;
  if (text === null) store = emptyStore();
  else {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'Записи повреждены: не читаются как данные.', raw: text };
    }
    try {
      store = migrate(parsed);
    } catch (e) {
      return { ok: false, error: e.message, raw: text };
    }
  }

  let last = text;
  return {
    ok: true,
    store,
    save(next) {
      const problems = validateStore(next);
      if (problems.length) throw new Error(`Не сохранено — в записи ошибка: ${problems.join('; ')}`);
      if (backend.getItem(key) !== last) {
        throw new Error('Записи изменились в другом окне приложения. Закрой лишние окна и открой приложение заново — ничего не потеряно.');
      }
      const out = JSON.stringify(next);
      try {
        backend.setItem(key, out);
      } catch (e) {
        throw new Error(e?.name === 'QuotaExceededError'
          ? 'Не сохранено: память для приложения заполнена.'
          : `Не сохранено: ${e.message}`);
      }
      if (backend.getItem(key) !== out) throw new Error('Не сохранено: телефон не подтвердил запись.');
      last = out;
    },
  };
}

// Файл копии: те же данные, что в памяти, — из него записи восстанавливаются
// той же проверкой, что и при открытии приложения (migrate).
export const backupFile = (store, date) => ({
  name: `trenirovki-${date}.json`,
  text: JSON.stringify(store, null, 1),
});

// Когда копия сохранялась в последний раз ('ГГГГ-ММ-ДД' или null). Это
// подсказка, не данные Евы: сбой здесь ничего не ломает.
export function lastBackupDate(backend) {
  try {
    return backend.getItem(BACKUP_KEY);
  } catch {
    return null;
  }
}

export function markBackup(backend, date) {
  try {
    backend.setItem(BACKUP_KEY, date);
  } catch {
    // подсказка не сохранилась — копия при этом уже у Евы
  }
}
