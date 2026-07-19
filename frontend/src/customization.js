export const DEFAULT_CUSTOMIZATION = Object.freeze({
  orca_skin: "default",
  header_style: "default",
  bottom_style: "default",
  background_style: "default",
  theme: "dark",
});

export const CUSTOMIZATION_GROUPS = [
  {
    id: "orca_skin",
    label: "Скін",
    labelEn: "Skin",
    description: "Оберіть скін для базового персонажа.",
    descriptionEn: "Choose the mascot's base skin.",
    options: [
      { id: "default", name: "Косатка", nameEn: "Orca", asset: "/visuals/base-killer-whale.png" },
      { id: "dolphin", name: "Дельфін", nameEn: "Dolphin", asset: "/visuals/skin-dolphin.png" },
    ],
  },
  {
    id: "header_style",
    label: "Аксесуари",
    labelEn: "Accessories",
    description: "Додайте персонажу впізнаваний акцент.",
    descriptionEn: "Give your mascot a recognizable accent.",
    options: [
      { id: "default", name: "Без шолома", nameEn: "No helmet", asset: null },
      { id: "ukrainian", name: "Козацька шапка", nameEn: "Cossack hat", asset: "/visuals/hat-ukrainian.png" },
      { id: "space", name: "Шолом", nameEn: "Space helmet", asset: "/visuals/hat-space.png" },
      { id: "hawaii", name: "Рожеві окуляри", nameEn: "Pink glasses", asset: "/visuals/hat-hawaiian.png" },
      { id: "otaku", name: "Пов’язка", nameEn: "Headband", asset: "/visuals/hat-otaku.png" },
      { id: "skater", name: "Кепка", nameEn: "Cap", asset: "/visuals/hat-skater.png" },
    ],
  },
  {
    id: "bottom_style",
    label: "Образ",
    labelEn: "Outfit",
    description: "Оберіть завершений образ для персонажа.",
    descriptionEn: "Choose a complete outfit for your mascot.",
    options: [
      { id: "default", name: "Без костюма", nameEn: "No suit", asset: null },
      { id: "ukrainian", name: "Український", nameEn: "Ukrainian", asset: "/visuals/outfit-ukrainian.png" },
      { id: "cottagecore", name: "Светр", nameEn: "Sweater", asset: "/visuals/outfit-cottagecore.png" },
      { id: "cyberpunk", name: "Куртка кіберпанк", nameEn: "Cyberpunk jacket", asset: "/visuals/outfit-cyberpunk.png" },
      { id: "glitch", name: "Куртка глітч", nameEn: "Glitch jacket", asset: "/visuals/outfit-glitch.png" },
      { id: "hawaii", name: "Сорочка з ананасами", nameEn: "Pineapple shirt", asset: "/visuals/outfit-hawaiian.png" },
      { id: "mexica", name: "Хустка", nameEn: "Bandana", asset: "/visuals/outfit-mexican.png" },
      { id: "otaku", name: "Отаку", nameEn: "Otaku", asset: "/visuals/outfit-otaku.png" },
      { id: "skater", name: "Сорочка з футболкою", nameEn: "Skater shirt", asset: "/visuals/outfit-skater.png" },
      { id: "space", name: "Куртка космонавта", nameEn: "Astronaut jacket", asset: "/visuals/outfit-space.png" },
      { id: "y2k", name: "Спортивна кофта", nameEn: "Track jacket", asset: "/visuals/outfit-y2k.png" },
      { id: "gimnazia", name: "Халат", nameEn: "Lab coat", asset: "/visuals/outfit-gimnazia.png" },
    ],
  },
  {
    id: "background_style",
    label: "Фон",
    labelEn: "Background",
    description: "Оберіть місце, відкрите вашими досягненнями.",
    descriptionEn: "Choose a scene unlocked by your achievements.",
    options: [
      { id: "default", name: "Білий фон", nameEn: "White background", asset: null },
      { id: "sunflowers", name: "Соняшники", nameEn: "Sunflowers", background: true },
      { id: "sakura", name: "Сакури", nameEn: "Sakura", background: true },
      { id: "tropical-beach", name: "Тропічний пляж", nameEn: "Tropical beach", background: true },
      { id: "city", name: "Місто", nameEn: "City", background: true },
      { id: "shop", name: "Магазин", nameEn: "Shop", background: true },
      { id: "skatepark", name: "Скейт-парк", nameEn: "Skate park", background: true },
      { id: "space", name: "Космос", nameEn: "Space", background: true },
      { id: "fountain", name: "Фонтан", nameEn: "Fountain", background: true },
      { id: "garden", name: "Сад", nameEn: "Garden", background: true },
      { id: "color-splash", name: "Кольоровий вибух", nameEn: "Colour splash", background: true },
      { id: "digital-world", name: "Цифровий світ", nameEn: "Digital world", background: true },
      { id: "pixel-world", name: "Піксельний світ", nameEn: "Pixel world", background: true },
      { id: "concert", name: "Концерт", nameEn: "Concert", background: true },
      { id: "candy-land", name: "Країна солодощів", nameEn: "Candy land", background: true },
      { id: "pirate-bay", name: "Піратська бухта", nameEn: "Pirate bay", background: true },
      { id: "ice-castle", name: "Крижаний замок", nameEn: "Ice castle", background: true },
      { id: "volcano", name: "Вулкан", nameEn: "Volcano", background: true },
      { id: "medieval-castle", name: "Середньовічний замок", nameEn: "Medieval castle", background: true },
      { id: "desert", name: "Пустеля", nameEn: "Desert", background: true },
      { id: "arcade", name: "Аркада", nameEn: "Arcade", background: true },
    ],
  },
];

export const THEMES = [
  { id: "dark", name: "Темна", nameEn: "Dark", icon: "theme-dark" },
  { id: "blue", name: "Синя", nameEn: "Blue", icon: "theme-blue" },
  { id: "green", name: "Зелена", nameEn: "Green", icon: "theme-green" },
  { id: "red", name: "Червона", nameEn: "Red", icon: "theme-red" },
  { id: "sunset", name: "Захід сонця", nameEn: "Sunset", icon: "theme-sunset" },
  { id: "neon", name: "Неон", nameEn: "Neon", icon: "theme-neon" },
];

const ALLOWED_VALUES = Object.fromEntries(
  CUSTOMIZATION_GROUPS.map((group) => [group.id, new Set(group.options.map((option) => option.id))])
);
ALLOWED_VALUES.theme = new Set(THEMES.map((theme) => theme.id));

export function normalizeCustomization(value = {}) {
  const compatibleValue = {
    ...value,
    header_style: value?.header_style === "none" ? "default" : value?.header_style,
    bottom_style: value?.bottom_style === "none" ? "default" : value?.bottom_style,
  };
  const customization = Object.fromEntries(
    Object.entries(DEFAULT_CUSTOMIZATION).map(([key, fallback]) => [
      key,
      ALLOWED_VALUES[key].has(compatibleValue?.[key]) ? compatibleValue[key] : fallback,
    ])
  );
  if (customization.orca_skin === "dolphin") {
    customization.header_style = "default";
    customization.bottom_style = "default";
  }
  return customization;
}

export function resolveMascot(value = {}) {
  const customization = normalizeCustomization(value);
  const skinGroup = CUSTOMIZATION_GROUPS.find((group) => group.id === "orca_skin");
  const headerGroup = CUSTOMIZATION_GROUPS.find((group) => group.id === "header_style");
  const bottomGroup = CUSTOMIZATION_GROUPS.find((group) => group.id === "bottom_style");
  const backgroundGroup = CUSTOMIZATION_GROUPS.find((group) => group.id === "background_style");
  const skin = skinGroup.options.find((option) => option.id === customization.orca_skin);
  const header = headerGroup.options.find((option) => option.id === customization.header_style);
  const bottom = bottomGroup.options.find((option) => option.id === customization.bottom_style);
  const background = backgroundGroup.options.find((option) => option.id === customization.background_style);
  return { skin, header, bottom, background, layers: [skin, bottom, header].filter((option) => option.asset) };
}

export function applyCustomization(value, root = typeof document !== "undefined" ? document.documentElement : null) {
  const customization = normalizeCustomization(value);
  if (root) {
    root.dataset.orcaSkin = customization.orca_skin;
    root.dataset.headerStyle = customization.header_style;
    root.dataset.bottomStyle = customization.bottom_style;
    root.dataset.backgroundStyle = customization.background_style;
    root.dataset.theme = customization.theme;
  }
  return customization;
}
