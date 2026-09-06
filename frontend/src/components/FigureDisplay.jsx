function toImageSrc(image) {
  const trimmed = String(image || "").trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed}`;
}

export default function FigureDisplay({ name, image }) {
  const src = toImageSrc(image);
  const title = name || "Figure";

  if (!src) {
    return (
      <figure className="figure-display">
        <div className="figure-frame">No image was returned for this figure.</div>
        <figcaption>
          <strong>{title}</strong>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure className="figure-display">
      <img src={src} alt={title} />
      <figcaption>
        <strong>{title}</strong>
      </figcaption>
    </figure>
  );
}
