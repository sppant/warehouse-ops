import { NavLink, Outlet } from "react-router-dom";
import type { NavLinkRenderProps } from "react-router-dom";

const navigation = [
  { label: "Dashboard", path: "/" },
  { label: "Inventory", path: "/inventory" },
  { label: "Products", path: "/products" },
  { label: "Orders", path: "/orders" },
  { label: "Receiving", path: "/receiving" },
  { label: "Locations", path: "/locations" },
  { label: "Cycle Counts", path: "/cycle-counts" },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>Warehouse Ops</strong>
            <span>Operations</span>
          </div>
        </div>

        <nav className="navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }: NavLinkRenderProps) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          System operational
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Warehouse</span>
            <strong>Central Operations</strong>
          </div>

          <div className="user-menu">
            <div className="avatar">SP</div>
            <span>Operator</span>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
