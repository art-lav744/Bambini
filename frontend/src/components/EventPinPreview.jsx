export const EVENT_PINS = [
  { id: "default", label: "Стандартна" },
  { id: "football", label: "Футбол" },
  { id: "basketball", label: "Баскетбол" },
  { id: "volleyball", label: "Волейбол" },
  { id: "tennis", label: "Теніс" },
  { id: "pingpong", label: "Пінг-понг" },
  { id: "eightball", label: "Більярд" },
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
