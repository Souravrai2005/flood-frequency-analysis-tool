export default function ResultCard({ title, kicker, children, actions }) {
  return (
    <section className="result-card">
      <div className="result-card-head">
        <div>
          {kicker ? <div className="section-kicker">{kicker}</div> : null}
          <h2>{title}</h2>
        </div>
        {actions}
      </div>
      <div className="result-card-body">{children}</div>
    </section>
  );
}
