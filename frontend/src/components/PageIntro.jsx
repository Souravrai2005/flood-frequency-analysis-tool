export default function PageIntro({ title, children, tags = [] }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="lede">{children}</p>
      {tags.length > 0 ? (
        <div className="tag-row">
          {tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
