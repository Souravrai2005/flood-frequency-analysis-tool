export default function Header({ title, subtitle, onMenu }) {
  return (
    <header className="topbar">
      <button className="menu-button" type="button" onClick={onMenu}>
        Menu
      </button>
      <div className="topbar-copy">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="station-chip">
        Station <strong>Ukai · 62,255 km²</strong>
      </div>
    </header>
  );
}
