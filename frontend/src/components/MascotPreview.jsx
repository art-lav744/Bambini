import { resolveMascot } from "../customization.js";
import { useI18n } from "../i18n.js";

export default function MascotPreview({ customization, className = "" }) {
  const { language, tr } = useI18n();
  const { skin, header, bottom, background, layers } = resolveMascot(customization);
  const optionName = (option) => language === "en" ? option.nameEn || option.name : option.name;

  return (
    <div
      className={`customization-mascot mascot-background--${background.id}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label={tr(
        `Сконструйований образ: ${optionName(skin)}, ${optionName(header)}, ${optionName(bottom)}, фон ${optionName(background)}`,
        `Customized mascot: ${optionName(skin)}, ${optionName(header)}, ${optionName(bottom)}, background ${optionName(background)}`,
      )}
    >
      {layers.map((layer) => (
        <img key={layer.asset} className="customization-mascot__layer" src={layer.asset} alt="" />
      ))}
    </div>
  );
}
