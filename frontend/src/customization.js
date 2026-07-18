export const DEFAULT_CUSTOMIZATION = Object.freeze({
  orca_skin: "default",
  header_style: "default",
  bottom_style: "default",
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
      { id: "none", name: "Без шолома", asset: null },
      { id: "default", name: "Козацька шапка", asset: "/visuals/hat-ukrainian.png" },
      { id: "space", name: "Космонавт", asset: "/visuals/hat-space.png" },
      { id: "hawaii", name: "Рожеві окуляри", asset: "/visuals/hat-hawaiian.png" },
      { id: "otaku", name: "Самурай", asset: "/visuals/hat-otaku.png" },
      { id: "skater", name: "Кепка", asset: "/visuals/hat-skater.png" },
    ],
  },
  {
    id: "bottom_style",
    label: "Образ",
    description: "Оберіть завершений образ для персонажа.",
    options: [
      { id: "none", name: "Без костюма", asset: null },
      { id: "default", name: "Український", asset: "/visuals/outfit-ukrainian.png" },
      { id: "cottagecore", name: "Котеджкор", asset: "/visuals/outfit-cottagecore.png" },
      { id: "cyberpunk", name: "Кіберпанк", asset: "/visuals/outfit-cyberpunk.png" },
      { id: "glitch", name: "Глітч", asset: "/visuals/outfit-glitch.png" },
      { id: "hawaii", name: "Гаваї", asset: "/visuals/outfit-hawaiian.png" },
      { id: "mexica", name: "Мексика", asset: "/visuals/outfit-mexican.png" },
      { id: "otaku", name: "Отаку", asset: "/visuals/outfit-otaku.png" },
      { id: "skater", name: "Скейтер", asset: "/visuals/outfit-skater.png" },
      { id: "space", name: "Космос", asset: "/visuals/outfit-space.png" },
      { id: "y2k", name: "Y2K", asset: "/visuals/outfit-y2k.png" },
      { id: "gimnazia", name: "Гімназія", asset: "/visuals/outfit-gimnazia.png" },
    ],
  },
];

export const THEMES = [
  { id: "dark", name: "Темна", symbol: "◐" },
  { id: "blue", name: "Синя", symbol: "≈" },
  { id: "green", name: "Зелена", symbol: "●" },
  { id: "red", name: "Червона", symbol: "◆" },
  { id: "sunset", name: "Захід сонця", symbol: "☼" },
  { id: "neon", name: "Неон", symbol: "✦" },
];

const ALLOWED_VALUES = Object.fromEntries(
  CUSTOMIZATION_GROUPS.map((group) => [group.id, new Set(group.options.map((option) => option.id))])
);
ALLOWED_VALUES.theme = new Set(THEMES.map((theme) => theme.id));

export function normalizeCustomization(value = {}) {
  const customization = Object.fromEntries(
    Object.entries(DEFAULT_CUSTOMIZATION).map(([key, fallback]) => [
      key,
      ALLOWED_VALUES[key].has(value?.[key]) ? value[key] : fallback,
    ])
  );
  if (customization.orca_skin === "dolphin") {
    customization.header_style = "none";
    customization.bottom_style = "none";
  }
  return customization;
}

export function resolveMascot(value = {}) {
  const customization = normalizeCustomization(value);
  const [skinGroup, headerGroup, bottomGroup] = CUSTOMIZATION_GROUPS;
  const skin = skinGroup.options.find((option) => option.id === customization.orca_skin);
  const header = headerGroup.options.find((option) => option.id === customization.header_style);
  const bottom = bottomGroup.options.find((option) => option.id === customization.bottom_style);
  return { skin, header, bottom, layers: [skin, bottom, header].filter((option) => option.asset) };
}

export function applyCustomization(value, root = typeof document !== "undefined" ? document.documentElement : null) {
  const customization = normalizeCustomization(value);
  if (root) {
    root.dataset.orcaSkin = customization.orca_skin;
    root.dataset.headerStyle = customization.header_style;
    root.dataset.bottomStyle = customization.bottom_style;
    root.dataset.theme = customization.theme;
  }
  return customization;
}
