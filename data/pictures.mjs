// Рисунки упражнений: начало и конец движения. Только то, что можно
// законно показывать в открытом приложении и что точно совпадает с
// упражнением (Р-37). Сейчас — Everkinetic (https://github.com/everkinetic/data),
// CC BY-SA 4.0: авторство обязательно, рисунки не меняем. Чужие картинки
// «из интернета» сюда не попадают, даже если их выдают за свободные
// (free-exercise-db, часть картинок wger). Упражнения без точного рисунка
// остаются без него — до фото тренажёров из её зала.

export const CREDITS = {
  everkinetic: {
    text: 'Рисунок: Everkinetic, CC BY-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  },
};

const ek = (id, ext = 'svg') => ({ files: [`images/${id}-1.${ext}`, `images/${id}-2.${ext}`], credit: 'everkinetic' });

export const PICTURES = {
  legPress: ek('legPress'),
  legExtension: ek('legExtension'),
  legCurlSeated: ek('legCurlSeated'),
  legCurlLying: ek('legCurlLying'),
  abduction: ek('abduction'),
  adduction: ek('adduction'),
  calfRaise: ek('calfRaise'),
  chestPress: ek('chestPress'),
  chestFly: ek('chestFly', 'jpg'),
  shoulderPress: ek('shoulderPress', 'jpg'),
  lateralRaise: ek('lateralRaise'),
  seatedRow: ek('seatedRow'),
  latPulldown: ek('latPulldown', 'jpg'),
  tricepsPushdown: ek('tricepsPushdown'),
  romanianDeadlift: ek('romanianDeadlift'),
};

// Упражнения без точного рисунка: ссылка на поиск картинок в интернете —
// как ссылка на видео в таблице. Картинки открываются у их авторов, в
// приложение не копируются. Запрос по-английски — так находятся именно эти
// тренажёры.
export const PICTURE_SEARCH = {
  reverseFly: 'reverse pec deck machine rear delt fly',
  facePull: 'cable face pull rope exercise',
  hipThrustMachine: 'hip thrust machine exercise',
  abCrunchMachine: 'ab crunch machine exercise',
  backExtensionMachine: 'seated back extension machine exercise',
};

export const pictureSearchUrl = (id) => (PICTURE_SEARCH[id]
  ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(PICTURE_SEARCH[id])}`
  : null);
