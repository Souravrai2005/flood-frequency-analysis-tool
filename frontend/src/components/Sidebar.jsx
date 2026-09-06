import { NavLink } from "react-router-dom";
import logo from "../assets/hydrograph.svg";

const groups = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Home", end: true },
      { to: "/dashboard", label: "Dashboard" },
      { to: "/data", label: "Data" },
    ],
  },
  {
    label: "Analysis",
    items: [
      { to: "/univariate", label: "Univariate" },
      { to: "/bivariate", label: "Bivariate" },
      { to: "/trivariate", label: "Trivariate", badge: "Future" },
      { to: "/classification", label: "Classification" },
    ],
  },
  {
    label: "Outputs",
    items: [{ to: "/results", label: "Results" }],
  },
  {
    label: "Reference",
    items: [
      { to: "/methodology", label: "Methodology" },
      { to: "/about", label: "About" },
    ],
  },
];

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand">
        <img src={logo} alt="" />
        <div>
          <div className="brand-kicker">Hydrologic design</div>
          <h1>Flood Frequency Analysis Tool</h1>
        </div>
      </div>

      {groups.map((group) => (
        <nav className="nav-group" key={group.label} aria-label={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={onNavigate}
            >
              <span>{item.label}</span>
              {item.badge ? <span className="badge">{item.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
      ))}

      <div className="sidebar-foot">
        B.Tech project interface. Statistical analysis remains on the Python
        layer; this screen is the application shell only.
      </div>
    </aside>
  );
}
