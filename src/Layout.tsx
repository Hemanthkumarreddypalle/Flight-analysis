import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import css from "./Layout.module.css";

interface LayoutProps {
  children?: ReactNode;
}

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/flights", label: "Flights" },
  { to: "/airports", label: "Airports" },
  { to: "/routes", label: "Routes" },
  { to: "/aircraft", label: "Aircraft" },
];

function Layout({ children }: LayoutProps) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navOpen]);

  return (
    <div className={css.shell}>
      <button
        type="button"
        className={css.navTrigger}
        aria-label={navOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((open) => !open)}
      >
        <span className={css.triggerIcon} aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className={css.triggerText}>Navigation</span>
      </button>

      <Link to="/" className={css.homeTrigger} aria-label="Go to home">
        <span className={css.homeIcon} aria-hidden>
          <svg viewBox="0 0 24 24" focusable="false">
            <path d="M12 3.2 3.5 10v10.3h5.8v-6.1h5.4v6.1h5.8V10L12 3.2Z" />
          </svg>
        </span>
        <span className={css.homeText}>Home</span>
      </Link>

      {navOpen ? (
        <div className={css.popupLayer}>
          <button
            type="button"
            className={css.popupBackdrop}
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <span className={css.srOnly}>Close navigation</span>
          </button>

          <aside className={css.popupNav} role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className={css.popupHeader}>
              <div className={css.sidebarBrand}>
                <span className={css.flightBadge} aria-hidden>
                  ✈
                </span>
                <div>
                  <p>Flight Ops</p>
                  <h2>Navigation</h2>
                </div>
              </div>

              <button
                type="button"
                className={css.closeButton}
                onClick={() => setNavOpen(false)}
              >
                Close
              </button>
            </div>

            <nav className={css.nav}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive ? `${css.navLink} ${css.navLinkActive}` : css.navLink
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className={css.mainArea}>
        <main className={css.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
