import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";

export default function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="shell">
      <Sidebar open={open} onNavigate={() => setOpen(false)} />
      {open ? (
        <button
          className="overlay"
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <div className="workspace">
        <Outlet context={{ openSidebar: () => setOpen(true) }} />
      </div>
    </div>
  );
}
