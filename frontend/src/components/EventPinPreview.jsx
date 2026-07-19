export const EVENT_PINS = [
  { id: "default", label: "Стандартна", labelEn: "Default" },
  { id: "football", label: "Футбол", labelEn: "Football" },
  { id: "basketball", label: "Баскетбол", labelEn: "Basketball" },
  { id: "volleyball", label: "Волейбол", labelEn: "Volleyball" },
  { id: "tennis", label: "Теніс", labelEn: "Tennis" },
  { id: "pingpong", label: "Пінг-понг", labelEn: "Table tennis" },
  { id: "eightball", label: "Більярд", labelEn: "Billiards" },
];

export default function EventPinPreview({
  type = "default",
  capacity = null,
  current = 0,
  imageUrl = "",
}) {
  const hasCapacity = Number.isFinite(Number(capacity)) && Number(capacity) > 0;

  return (
    <span className={`sport-pin sport-pin--${type}`} aria-hidden="true">
      {type === "default" && imageUrl ? (
        <img className="sport-pin__image" src={imageUrl} alt="" />
      ) : null}
      <span className="sport-pin__seams" />
      {hasCapacity ? (
        <span className="sport-pin__capacity">{current}/{capacity}</span>
      ) : null}
    </span>
  );
}
