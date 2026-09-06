import { useOutletContext } from "react-router-dom";
import Header from "./Header.jsx";

export default function PageShell({ title, subtitle, children }) {
  const { openSidebar } = useOutletContext();

  return (
    <>
      <Header title={title} subtitle={subtitle} onMenu={openSidebar} />
      <main className="content">{children}</main>
    </>
  );
}
