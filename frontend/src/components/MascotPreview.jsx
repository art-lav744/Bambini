import { resolveMascot } from "../customization.js";

export default function MascotPreview({ customization, className = "" }) {
  const { skin, header, bottom, layers } = resolveMascot(customization);

  return (
    <div
      className={`customization-mascot${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={`Сконструйований образ: ${skin.name}, ${header.name}, ${bottom.name}`}
    >
      {layers.map((layer) => (
        <img key={layer.asset} className="customization-mascot__layer" src={layer.asset} alt="" />
      ))}
    </div>
  );
}
