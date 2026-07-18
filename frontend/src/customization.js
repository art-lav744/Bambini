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
    description: "Оберіть скін для базового персонажа.",
    options: [
      { id: "default", name: "Косатка", asset: "/visuals/base-killer-whale.png" },
      { id: "dolphin", name: "Дельфін", asset: "/visuals/skin-dolphin.png" },
    ],
  },
  {
    id: "header_style",
    label: "Аксесуари",
    description: "Додайте персонажу впізнаваний акцент.",
    options: [
      { id: "default", name: "Без шолома", asset: null },
      { id: "ukrainian", name: "Козацька шапка", asset: "/visuals/hat-ukrainian.png" },
      { id: "space", name: "Шолом", asset: "/visuals/hat-space.png" },
      { id: "hawaii", name: "Рожеві окуляри", asset: "/visuals/hat-hawaiian.png" },
      { id: "otaku", name: "Пов’язка", asset: "/visuals/hat-otaku.png" },
      { id: "skater", name: "Кепка", asset: "/visuals/hat-skater.png" },
    ],
  },
  {
    id: "bottom_style",
    label: "Образ",
    description: "Оберіть завершений образ для персонажа.",
    options: [
      { id: "default", name: "Без костюма", asset: null },
      { id: "ukrainian", name: "Український", asset: "/visuals/outfit-ukrainian.png" },
      { id: "cottagecore", name: "Светр", asset: "/visuals/outfit-cottagecore.png" },
      { id: "cyberpunk", name: "Куртка кіберпанк", asset: "/visuals/outfit-cyberpunk.png" },
      { id: "glitch", name: "Куртка глітч", asset: "/visuals/outfit-glitch.png" },
      { id: "hawaii", name: "Сорочка з ананасами", asset: "/visuals/outfit-hawaiian.png" },
      { id: "mexica", name: "Хустка", asset: "/visuals/outfit-mexican.png" },
      { id: "otaku", name: "Отаку", asset: "/visuals/outfit-otaku.png" },
      { id: "skater", name: "Сорочка з футболкою", asset: "/visuals/outfit-skater.png" },
      { id: "space", name: "Куртка космонавта", asset: "/visuals/outfit-space.png" },
      { id: "y2k", name: "Спортивна кофта", asset: "/visuals/outfit-y2k.png" },
      { id: "gimnazia", name: "Халат", asset: "/visuals/outfit-gimnazia.png" },
    ],
  },
  {
    id: "background_style",
    label: "Фон",
    description: "Оберіть місце, відкрите вашими досягненнями.",
    options: [
      { id: "default", name: "Білий фон", asset: null },
      { id: "sunflowers", name: "Соняшники", background: true },
      { id: "sakura", name: "Сакури", background: true },
      { id: "tropical-beach", name: "Тропічний пляж", background: true },
      { id: "city", name: "Місто", background: true },
      { id: "shop", name: "Магазин", background: true },
      { id: "skatepark", name: "Скейт-парк", background: true },
      { id: "space", name: "Космос", background: true },
      { id: "fountain", name: "Фонтан", background: true },
      { id: "garden", name: "Сад", background: true },
      { id: "color-splash", name: "Кольоровий вибух", background: true },
      { id: "digital-world", name: "Цифровий світ", background: true },
      { id: "pixel-world", name: "Піксельний світ", background: true },
      { id: "concert", name: "Концерт", background: true },
      { id: "candy-land", name: "Країна солодощів", background: true },
      { id: "pirate-bay", name: "Піратська бухта", background: true },
      { id: "ice-castle", name: "Крижаний замок", background: true },
      { id: "volcano", name: "Вулкан", background: true },
      { id: "medieval-castle", name: "Середньовічний замок", background: true },
      { id: "desert", name: "Пустеля", background: true },
      { id: "arcade", name: "Аркада", background: true },
    ],
  },
];

export const THEMES = [
  { id: "dark", name: "Темна", icon: "theme-dark" },
  { id: "blue", name: "Синя", icon: "theme-blue" },
  { id: "green", name: "Зелена", icon: "theme-green" },
  { id: "red", name: "Червона", icon: "theme-red" },
  { id: "sunset", name: "Захід сонця", icon: "theme-sunset" },
  { id: "neon", name: "Неон", icon: "theme-neon" },
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
