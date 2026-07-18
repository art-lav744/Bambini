import { resolveMascot } from "../customization.js";

export default function MascotPreview({ customization, className = "" }) {
  const { skin, header, bottom, background, layers } = resolveMascot(customization);

  return (
    <div
      className={`customization-mascot mascot-background--${background.id}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`Сконструйований образ: ${skin.name}, ${header.name}, ${bottom.name}, фон ${background.name}`}
    >
      {layers.map((layer) => (
        <img key={layer.asset} className="customization-mascot__layer" src={layer.asset} alt="" />
      ))}
    </div>
  );
}
