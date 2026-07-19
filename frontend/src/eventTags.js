export const EVENT_TAG_OPTIONS = [
  // ==========================================
  // 1. СПОРТ / АКТИВНИЙ ВІДПОЧИНОК / RECREATION
  // ==========================================
  { value: "sport", label: "Загальний спорт" },
  { value: "football", label: "Футбол" },
  { value: "basketball", label: "Баскетбол" },
  { value: "volleyball", label: "Волейбол (пляжний/класичний)" },
  { value: "tennis", label: "Теніс (великий)" },
  { value: "table-tennis", label: "Настільний теніс" },
  { value: "badminton", label: "Бадмінтон" },
  { value: "padel-squash", label: "Падел та сквош" },
  { value: "running", label: "Біг та марафони" },
  { value: "cycling", label: "Велосипедні прогулянки/заїзди" },
  { value: "skate-roller", label: "Скейтборд, ролики, самокати" },
  { value: "swimming-pool", label: "Плавання та басейни" },
  { value: "water-sports", label: "Сапи, каяки, кайтсерфінг" },
  { value: "martial-arts", label: "Єдиноборства та бокс" },
  { value: "gymnastics-acro", label: "Гімнастика та акробатика" },
  { value: "climbing", label: "Скелелазіння (боулдеринг)" },
  { value: "extreme-sports", label: "Екстремальний спорт (роуп-джампінг тощо)" },
  { value: "winter-sports", label: "Лижі, сноуборд, ковзани" },
  { value: "chess", label: "Шахи та шашки" },
  { value: "billiards-bowling", label: "Більярд та боулінг" },
  { value: "golf", label: "Гольф / міні-гольф" },

  // ==========================================
  // 2. ТУРИЗМ / ПРИРОДА / OUTDOOR
  // ==========================================
  { value: "walk", label: "Прогулянка містом" },
  { value: "picnic", label: "Пікнік та барбекю" },
  { value: "hiking", label: "Пішохідний туризм та походи" },
  { value: "camping", label: "Кемпінг та глемпінг" },
  { value: "excursion", label: "Екскурсії (міські/заміські)" },
  { value: "fishing-hunting", label: "Риболовля та полювання" },
  { value: "stargazing", label: "Астрономія та спостереження за зірками" },
  { value: "birdwatching", label: "Бьордвотчінг (спостереження за птахами)" },

  // ==========================================
  // 3. МУЗИКА / КІНО / ТЕАТР / ШОУ
  // ==========================================
  { value: "music-concert", label: "Концерти та жива музика" },
  { value: "music-fest", label: "Музичні фестивалі" },
  { value: "opera-ballet", label: "Опера та балет" },
  { value: "theater", label: "Театр та перформанси" },
  { value: "cinema-openair", label: "Кінопокази (в т.ч. просто неба)" },
  { value: "standup-comedy", label: "Стендап та гумористичні шоу" },
  { value: "karaoke", label: "Караоке-вечірки" },
  { value: "dj-set", label: "DJ-сети та електронна музика" },
  { value: "jam-session", label: "Джем-сейшни (імпровізація)" },
  { value: "musical-instrument-lessons", label: "Музичні майстер-класи" },

  // ==========================================
  // 4. КУЛЬТУРА / МИСТЕЦТВО / ХОБІ
  // ==========================================
  { value: "art-exhibition", label: "Виставки та галереї" },
  { value: "museum", label: "Музеї та історичні заходи" },
  { value: "literature-club", label: "Книжкові клуби та презентації" },
  { value: "poetry-night", label: "Поетичні вечори" },
  { value: "painting-drawing", label: "Малювання та живопис (арт-вечірки)" },
  { value: "sculpture-pottery", label: "Гончарство та ліпка" },
  { value: "photography", label: "Фотопрогулянки та фотовиставки" },
  { value: "handicraft", label: "В’язання, вишивка, хендмейд" },
  { value: "modelling", label: "Моделювання (авіа, авто, мініатюри)" },
  { value: "dance-bachata", label: "Соціальні танці (бачата, сальса, танго)" },
  { value: "dance-modern", label: "Сучасні танці та хіп-хоп" },

  // ==========================================
  // 5. ГІК-КУЛЬТУРА / ІГРИ / SUB-CULTURE
  // ==========================================
  { value: "board-games", label: "Настільні ігри" },
  { value: "rpg-dnd", label: "Рольові ігри (D&D, Мафія)" },
  { value: "pub-quiz", label: "Квізи, паб-вікторини, брейн-ринги" },
  { value: "gaming-pc-console", label: "Відеоігри (LAN-турніри, консолі)" },
  { value: "esports", label: "Кіберспортивні трансляції/події" },
  { value: "anime-cosplay", label: "Аніме зустрічі та косплей" },
  { value: "comic-con", label: "Гік-фестивалі та комікси" },

  // ==========================================
  // 6. ГАСТРОНОМІЯ / FOOD & DRINK
  // ==========================================
  { value: "coffee", label: "Кава та капінги" },
  { value: "tea-ceremony", label: "Чаювання та чайні церемонії" },
  { value: "wine-tasting", label: "Дегустації вина та сиру" },
  { value: "craft-beer", label: "Крафтове пиво та паб-кроули" },
  { value: "cocktail-party", label: "Коктейльні вечори" },
  { value: "food-court", label: "Фестивалі вуличної їжі" },
  { value: "restaurant-opening", label: "Відкриття закладів та гастро-вечері" },
  { value: "cooking-masterclass", label: "Кулінарні майстер-класи" },
  { value: "vegan-vegetarian", label: "Веганські та вегетаріанські події" },

  // ==========================================
  // 7. НІЧНЕ ЖИТТЯ / PARTY
  // ==========================================
  { value: "party-home", label: "Домашні вечірки (квартирники)" },
  { value: "night-club", label: "Клуби, рейви та техно" },
  { value: "bar-hopping", label: "Прогулянки барами (Bar Crawl)" },
  { value: "pool-party", label: "Вечірки біля басейну" },

  // ==========================================
  // 8. БІЗНЕС / НЕТВОРКІНГ / IT
  // ==========================================
  { value: "networking", label: "Знайомства та нетворкінг" },
  { value: "speed-dating", label: "Швидкі побачення (Speed Dating)" },
  { value: "business-conference", label: "Конференції та форуми" },
  { value: "startup-pitch", label: "Стартап-пітчі та хакатони" },
  { value: "it-meetup", label: "IT-мітапи та розробка" },
  { value: "marketing-pr", label: "Маркетинг, PR та реклама" },
  { value: "crypto-web3", label: "Крипта, NFT та Web3 зустрічі" },
  { value: "investing-finance", label: "Інвестиції та фінансова грамотність" },
  { value: "e-commerce", label: "Торгівля, маркетплейси, товарка" },

  // ==========================================
  // 9. ОСВІТА / САМОРОЗВИТОК / НАУКА
  // ==========================================
  { value: "lecture", label: "Лекції та публічні виступи" },
  { value: "seminar-training", label: "Семінари та практичні тренінги" },
  { value: "language-club", label: "Мовні клуби (Speaking clubs)" },
  { value: "science-pop", label: "Науково-популярні лекції" },
  { value: "tedx-format", label: "Події у форматі TEDx" },
  { value: "oratory-skills", label: "Ораторське мистецтво та дебати" },

  // ==========================================
  // 10. СІМ’Я / ДІТИ
  // ==========================================
  { value: "family-day", label: "Сімейні свята та дні громади" },
  { value: "kids-entertainment", label: "Аніматори та дитячі розваги" },
  { value: "kids-development", label: "Розвиваючі гуртки та ментальна арифметика" },
  { value: "parenting-club", label: "Клуби для батьків / майбутніх мам" },
  { value: "baby-fairs", label: "Дитячі ярмарки та виставки" },

  // ==========================================
  // 11. ЗДОРОВ’Я / КРАСА / ВЕЛНЕС
  // ==========================================
  { value: "fitness-group", label: "Груповий фітнес та кросфіт" },
  { value: "yoga-stretching", label: "Йога, стретчинг, пілатес" },
  { value: "meditation-sound-healing", label: "Медитація та звукотерапія" },
  { value: "psychology-group", label: "Психологічні групи та терапія" },
  { value: "beauty-day", label: "Дні краси, макіяж, б’юті-воркшопи" },
  { value: "healthy-lifestyle", label: "Зож-лекції та нутриціологія" },
  { value: "spa-sauna", label: "Банні культури, SPA та релакс" },

  // ==========================================
  // 12. БЛАГОДІЙНІСТЬ / СУСПІЛЬСТВО / ЕКО
  // ==========================================
  { value: "charity-auction", label: "Благодійні аукціони та збори" },
  { value: "volunteer-work", label: "Волонтерські ініціативи" },
  { value: "eco-cleanup", label: "Еко-толоки, прибирання парків" },
  { value: "animal-shelter-help", label: "Допомога притулкам для тварин" },
  { value: "blood-donation", label: "Дні донорства крові" },
  { value: "urbanism-community", label: "Урбаністика та обговорення розвитку міста" },

  // ==========================================
  // 13. ШОПІНГ / МАРКЕТИ / ВИСТАВКИ-ПРОДАЖІ
  // ==========================================
  { value: "garage-sale", label: "Гаражні розпродажі" },
  { value: "flea-market", label: "Барахолки та антикваріат" },
  { value: "pop-up-market", label: "Крафтові маркети та локальні бренди" },
  { value: "fashion-show", label: "Покази мод та дизайн" },
  { value: "book-fair", label: "Книжкові ярмарки" },

  // ==========================================
  // 14. АВТО / МОТО / ТЕХНІКА
  // ==========================================
  { value: "auto-show", label: "Автовиставки та тюнінг" },
  { value: "moto-meetup", label: "Мотозльоти та байкерські заходи" },
  { value: "karting-race", label: "Картінг та аматорські перегони" },
  { value: "test-drive", label: "Тест-драйви новинок" },

  // ==========================================
  // 15. ТВАРИНИ / PETS
  // ==========================================
  { value: "pets-walk", label: "Спільні прогулянки з собаками" },
  { value: "pet-exhibition", label: "Виставки котів, собак, екзотичних тварин" },
  { value: "pet-friendly-event", label: "Події, куди можна з тваринами (загальні)" }
];

const LEGACY_EVENT_TAG_LABELS = new Map([
  ["music", "Музика"],
  ["cinema", "Кіно"],
  ["party", "Вечірка"],
  ["family", "Сім’я"],
  ["kids", "Діти"],
]);
const EVENT_TAG_VALUES = new Set([
  ...EVENT_TAG_OPTIONS.map((tag) => tag.value),
  ...LEGACY_EVENT_TAG_LABELS.keys(),
]);
const EVENT_TAG_LABELS = new Map([
  ...LEGACY_EVENT_TAG_LABELS,
  ...EVENT_TAG_OPTIONS.map((tag) => [tag.value, tag.label]),
]);

const ENGLISH_EVENT_TAG_LABELS = new Map([
  ["music", "Music"],
  ["cinema", "Cinema"],
  ["party", "Party"],
  ["family", "Family"],
  ["kids", "Kids"],
  ["sport", "General sport"],
  ["volleyball", "Volleyball (beach / indoor)"],
  ["tennis", "Tennis"],
  ["padel-squash", "Padel and squash"],
  ["running", "Running and marathons"],
  ["cycling", "Cycling rides"],
  ["skate-roller", "Skateboarding, rollerblading and scooters"],
  ["swimming-pool", "Swimming and pools"],
  ["water-sports", "SUP, kayaking and kitesurfing"],
  ["martial-arts", "Martial arts and boxing"],
  ["gymnastics-acro", "Gymnastics and acrobatics"],
  ["extreme-sports", "Extreme sports"],
  ["winter-sports", "Skiing, snowboarding and skating"],
  ["chess", "Chess and checkers"],
  ["billiards-bowling", "Billiards and bowling"],
  ["walk", "City walk"],
  ["picnic", "Picnic and barbecue"],
  ["hiking", "Hiking and trekking"],
  ["excursion", "Tours and excursions"],
  ["fishing-hunting", "Fishing and hunting"],
  ["stargazing", "Astronomy and stargazing"],
  ["birdwatching", "Birdwatching"],
  ["music-concert", "Concerts and live music"],
  ["music-fest", "Music festivals"],
  ["opera-ballet", "Opera and ballet"],
  ["theater", "Theatre and performance"],
  ["cinema-openair", "Cinema and open-air screenings"],
  ["standup-comedy", "Stand-up and comedy shows"],
  ["karaoke", "Karaoke parties"],
  ["dj-set", "DJ sets and electronic music"],
  ["jam-session", "Jam sessions"],
  ["musical-instrument-lessons", "Music workshops"],
  ["art-exhibition", "Exhibitions and galleries"],
  ["museum", "Museums and history"],
  ["literature-club", "Book clubs and presentations"],
  ["poetry-night", "Poetry nights"],
  ["painting-drawing", "Painting and drawing"],
  ["sculpture-pottery", "Pottery and sculpting"],
  ["photography", "Photo walks and exhibitions"],
  ["handicraft", "Knitting, embroidery and handmade"],
  ["modelling", "Scale modelling"],
  ["dance-bachata", "Social dancing"],
  ["dance-modern", "Modern dance and hip-hop"],
  ["board-games", "Board games"],
  ["rpg-dnd", "Role-playing games (D&D, Mafia)"],
  ["pub-quiz", "Pub quizzes and trivia"],
  ["gaming-pc-console", "Video games and LAN tournaments"],
  ["esports", "Esports events"],
  ["anime-cosplay", "Anime and cosplay"],
  ["comic-con", "Geek festivals and comics"],
  ["coffee", "Coffee and cupping"],
  ["tea-ceremony", "Tea and tea ceremonies"],
  ["wine-tasting", "Wine and cheese tastings"],
  ["craft-beer", "Craft beer and pub crawls"],
  ["cocktail-party", "Cocktail evenings"],
  ["food-court", "Street food festivals"],
  ["restaurant-opening", "Restaurant openings and dinners"],
  ["cooking-masterclass", "Cooking workshops"],
  ["vegan-vegetarian", "Vegan and vegetarian events"],
  ["party-home", "House parties"],
  ["night-club", "Clubs, raves and techno"],
  ["bar-hopping", "Bar crawl"],
  ["pool-party", "Pool parties"],
  ["networking", "Networking and meeting people"],
  ["speed-dating", "Speed dating"],
  ["business-conference", "Conferences and forums"],
  ["startup-pitch", "Startup pitches and hackathons"],
  ["it-meetup", "IT meetups and development"],
  ["marketing-pr", "Marketing, PR and advertising"],
  ["crypto-web3", "Crypto, NFT and Web3 meetups"],
  ["investing-finance", "Investing and financial literacy"],
  ["e-commerce", "E-commerce and marketplaces"],
  ["lecture", "Lectures and public speaking"],
  ["seminar-training", "Seminars and practical training"],
  ["language-club", "Language speaking clubs"],
  ["science-pop", "Popular science lectures"],
  ["tedx-format", "TEDx-style events"],
  ["oratory-skills", "Public speaking and debates"],
  ["family-day", "Family and community days"],
  ["kids-entertainment", "Children's entertainment"],
  ["kids-development", "Children's learning clubs"],
  ["parenting-club", "Parenting clubs"],
  ["baby-fairs", "Children's fairs and exhibitions"],
  ["fitness-group", "Group fitness and CrossFit"],
  ["yoga-stretching", "Yoga, stretching and Pilates"],
  ["meditation-sound-healing", "Meditation and sound healing"],
  ["psychology-group", "Psychology groups and therapy"],
  ["beauty-day", "Beauty and makeup workshops"],
  ["healthy-lifestyle", "Healthy lifestyle and nutrition"],
  ["spa-sauna", "Sauna, SPA and relaxation"],
  ["charity-auction", "Charity auctions and fundraisers"],
  ["volunteer-work", "Volunteering"],
  ["eco-cleanup", "Eco cleanups"],
  ["animal-shelter-help", "Animal shelter support"],
  ["blood-donation", "Blood donation"],
  ["urbanism-community", "Urbanism and community development"],
  ["garage-sale", "Garage sales"],
  ["flea-market", "Flea markets and antiques"],
  ["pop-up-market", "Craft markets and local brands"],
  ["fashion-show", "Fashion and design"],
  ["book-fair", "Book fairs"],
  ["auto-show", "Car shows and tuning"],
  ["moto-meetup", "Motorcycle meetups"],
  ["karting-race", "Karting and amateur racing"],
  ["test-drive", "Test drives"],
  ["pets-walk", "Group dog walks"],
  ["pet-exhibition", "Pet exhibitions"],
  ["pet-friendly-event", "Pet-friendly events"],
]);

function fallbackEnglishTagLabel(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((word) => ({ pc: "PC", dj: "DJ", it: "IT", spa: "SPA", golf: "Golf" }[word] || word))
    .join(" ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function normalizeEventTags(value, max = 5) {
  const result = [];
  const seen = new Set();
  for (const tag of Array.isArray(value) ? value : []) {
    if (!EVENT_TAG_VALUES.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= max) break;
  }
  return result;
}

export function toggleEventTag(value, tag, max = 5) {
  const selected = normalizeEventTags(value, max);
  if (selected.includes(tag)) return selected.filter((item) => item !== tag);
  if (!EVENT_TAG_VALUES.has(tag) || selected.length >= max) return selected;
  return [...selected, tag];
}

export function eventTagLabel(tag, language = "uk") {
  if (language === "en") return ENGLISH_EVENT_TAG_LABELS.get(tag) || fallbackEnglishTagLabel(tag);
  return EVENT_TAG_LABELS.get(tag) || tag;
}

export function filterEventsByTags(events, selectedTags) {
  const safeEvents = Array.isArray(events) ? events : [];
  const selected = new Set(normalizeEventTags(selectedTags, Number.POSITIVE_INFINITY));
  if (!selected.size) return safeEvents;
  return safeEvents.filter((event) => (event.tags || []).some((tag) => selected.has(tag)));
}
