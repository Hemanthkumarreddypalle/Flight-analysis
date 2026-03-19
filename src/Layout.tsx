import type { ReactNode } from "react";
import css from "./Layout.module.css";

interface LayoutProps {
  children?: ReactNode;
}

function Layout({ children }: LayoutProps) {
  return (
    <div className={css.container}>
      <header className={css.header}>
        <span className={css.flightBadge} aria-hidden>
          ✈
        </span>
        <div className={css.headerText}>
          <p>Flight Operations</p>
          <h1>Aviation Dashboard</h1>
        </div>
        <span className={css.flightBadge} aria-hidden>
          ✈
        </span>
      </header>
      <div className={css.content}>
        {children}
      </div>
    </div>
  );
}

export default Layout;
