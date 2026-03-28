import Link from "next/link";
import type { ReactNode } from "react";

type Role = "passageiro" | "motorista" | "admin";

interface NavItem {
  href: string;
  label: string;
}

const roleMeta: Record<Role, { title: string; subtitle: string }> = {
  passageiro: {
    title: "Passageiro MOVY",
    subtitle: "Viagem clara, segura e sob controle."
  },
  motorista: {
    title: "Motorista MOVY",
    subtitle: "Operacao com autonomia, ganho visivel e menos improviso."
  },
  admin: {
    title: "Operacao MOVY",
    subtitle: "Leitura rapida da operacao, risco e liquidez."
  }
};

export function AppShell({
  role,
  currentPath,
  navItems,
  headerBadge,
  children
}: {
  role: Role;
  currentPath: string;
  navItems: NavItem[];
  headerBadge: string;
  children: ReactNode;
}) {
  const meta = roleMeta[role];

  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <Link href="/" className="brand-lockup">
          <span className="brand-kicker">MOVY</span>
          <strong>O movimento agora e seu.</strong>
        </Link>

        <div className="sidebar-intro">
          <span className="meta-pill">{headerBadge}</span>
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>

        <nav className="sidebar-nav" aria-label={`Navegacao ${role}`}>
          {navItems.map((item) => {
            const active = currentPath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p>Seguranca visivel, precificacao explicavel e estados claros em toda a jornada.</p>
        </div>
      </aside>

      <div className="platform-main">
        <header className="platform-topbar panel">
          <div>
            <span className="section-kicker">Workspace</span>
            <h2>{meta.title}</h2>
          </div>
          <div className="topbar-actions">
            <Link href="/app/passageiro" className="meta-pill topbar-link">
              Passageiro
            </Link>
            <Link href="/app/motorista" className="meta-pill topbar-link">
              Motorista
            </Link>
            <Link href="/app/admin" className="meta-pill topbar-link">
              Admin
            </Link>
          </div>
        </header>

        <main className="platform-content">{children}</main>
      </div>
    </div>
  );
}
