export default function SectionHeader({ kicker, title, children }) {
  return (
    <div className="section-header">
      {kicker ? <div className="section-kicker">{kicker}</div> : null}
      <h2>{title}</h2>
      {children ? <p>{children}</p> : null}
    </div>
  );
}
