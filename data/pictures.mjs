// Рисунки упражнений: начало и конец движения, а если законного кадра
// начала нет — один кадр (phases). Только то, что можно законно показывать
// в открытом приложении и что точно совпадает с упражнением (Р-37, Р-39).
// Everkinetic (https://github.com/everkinetic/data), CC BY-SA 4.0: рисунки
// не меняем. Фото с Викисклада — лицензия сверена на странице файла; ссылка
// в подписи ведёт на неё (там автор, источник и лицензия — так CC 4.0
// разрешает указывать авторство); изменение фото названо в подписи. Чужие
// картинки «из интернета» сюда не попадают, даже если их выдают за
// свободные (free-exercise-db, часть картинок wger).

export const CREDITS = {
  everkinetic: {
    text: 'Рисунок: Everkinetic, CC BY-SA 4.0',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/deed.ru',
  },
  anchovyAsh: {
    text: 'Фото: AnchovyAsh, CC BY-SA 4.0, обрезано',
    url: 'https://commons.wikimedia.org/wiki/File:Curtis_jones_training.jpg',
  },
};

export const PHASES = ['начало', 'конец'];

const ek = (id, ext = 'svg') => ({
  files: [`images/${id}-1.${ext}`, `images/${id}-2.${ext}`], phases: PHASES, credit: 'everkinetic',
});

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
  facePull: { files: ['images/facePull.jpg'], phases: ['конец'], credit: 'anchovyAsh' },
  // Запасные (Р-40). Жим ногами под углом — тот же рисунок, что у жима ногами.
  legPress45: ek('legPress'),
  legPressCalfRaise: ek('legPressCalfRaise'),
  cableFly: ek('cableFly'),
  straightBarPushdown: ek('straightBarPushdown'),
  cableCrunchSeated: ek('cableCrunchSeated'),
};

// Упражнения без точного рисунка: ссылка на поиск картинок в интернете —
// как ссылка на видео в таблице. Картинки открываются у их авторов, в
// приложение не копируются. Запрос по-английски — так находятся именно эти
// тренажёры.
export const PICTURE_SEARCH = {
  reverseFly: 'reverse pec deck machine rear delt fly',
  hipThrustMachine: 'hip thrust machine exercise',
  abCrunchMachine: 'ab crunch machine exercise',
  backExtensionMachine: 'seated back extension machine exercise',
  // Запасные: у Everkinetic рисунка нет или он не совпадает (без троса, кадры
  // одинаковые, скамья без спинки).
  cableKickback: 'cable glute kickback ankle strap exercise',
  cableAbduction: 'standing cable hip abduction exercise',
  cableAdduction: 'standing cable hip adduction exercise',
  dbShoulderPress: 'seated dumbbell shoulder press back support exercise',
  cableReverseFly: 'standing reverse cable fly rear delt exercise',
  dbRow: 'one arm dumbbell row bench exercise',
};

export const pictureSearchUrl = (id) => (PICTURE_SEARCH[id]
  ? `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(PICTURE_SEARCH[id])}`
  : null);
