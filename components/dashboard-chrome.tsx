"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { CreditsBadge } from "@/components/credits-badge";

const sections = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/dashboard/studio", label: "AI Studio", icon: "sparkles" },
  { href: "/dashboard/calendar", label: "Calendar", icon: "calendar" },
  { href: "/dashboard/accounts", label: "Social accounts", icon: "accounts" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "chart" },
  { href: "/dashboard/media", label: "Media library", icon: "media" },
];

const settingsLink = { href: "/dashboard/settings", label: "Settings", icon: "settings" };

const sectionTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/studio": "AI Studio",
  "/dashboard/calendar": "Content calendar",
  "/dashboard/accounts": "Social accounts",
  "/dashboard/analytics": "Analytics",
  "/dashboard/media": "Media library",
  "/dashboard/settings": "Settings",
};

function NavigationIcon({
  name,
  size = 18,
}: {
  name: string;
  size?: number;
}) {
  const shared = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-7h6v7" /></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    accounts: <><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5.2a3 3 0 0 1 0 5.6M18 14a5 5 0 0 1 3 4.6V20" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    media: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" fill="currentColor" stroke="white" /><circle cx="15" cy="12" r="2" fill="currentColor" stroke="white" /><circle cx="10" cy="18" r="2" fill="currentColor" stroke="white" /></>,
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" {...shared}>
      {icons[name]}
    </svg>
  );
}

type DashboardChromeProps = {
  children: ReactNode;
  displayName: string;
  email: string;
  credits: number | null;
  profileError: boolean;
  connectedAccountsCount: number | null;
};

export function DashboardChrome({
  children,
  displayName,
  email,
  credits,
  profileError,
  connectedAccountsCount,
}: DashboardChromeProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = pathname.startsWith("/dashboard/studio")
    ? "AI Studio"
    : sectionTitles[pathname] ?? "Dashboard";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function renderNavItem(item: { href: string; label: string; icon: string }) {
    const active =
      item.href === "/dashboard"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        aria-current={active ? "page" : undefined}
        className={`dashboard-nav-link${active ? " active" : ""}`}
        href={item.href}
        key={item.href}
        onClick={() => setMenuOpen(false)}
      >
        <NavigationIcon name={item.icon} />
        <span>{item.label}</span>
        {item.href === "/dashboard/accounts" &&
          connectedAccountsCount !== null && (
          <span className="dashboard-nav-count">{connectedAccountsCount}</span>
        )}
      </Link>
    );
  }

  return (
    <div className="dashboard-app">
      {menuOpen && (
        <button
          aria-label="Close navigation menu"
          className="dashboard-sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}
      <aside className={`dashboard-sidebar${menuOpen ? " is-open" : ""}`}>
        <Link className="brand dashboard-brand" href="/dashboard">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>postly</span>
          <span className="dashboard-brand-label">STUDIO</span>
        </Link>

        <div className="dashboard-workspace">
          <span className="workspace-avatar">P</span>
          <span className="workspace-copy"><strong>Personal workspace</strong><small>Free plan</small></span>
          <span className="workspace-chevron">⌄</span>
        </div>

        <span className="dashboard-nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation" className="dashboard-nav">
          {sections.map(renderNavItem)}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <span className="dashboard-nav-label">PREFERENCES</span>
          {renderNavItem(settingsLink)}
          <div className="dashboard-sidebar-divider" />
          <div className="dashboard-account">
            <span className="dashboard-user-avatar">{initials || "P"}</span>
            <span className="dashboard-user-copy">
              <strong>{displayName}</strong>
              <small title={email}>{email}</small>
            </span>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            className="dashboard-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            <span /><span /><span />
          </button>
          <div className="dashboard-breadcrumb"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{title}</strong></div>
          <CreditsBadge initialCredits={credits} />
          <Link className="button button-dark dashboard-create-button" href="/dashboard/studio">
            <span aria-hidden="true">＋</span> Create post
          </Link>
        </header>
        <main className="dashboard-content">
          {profileError && (
            <div className="dashboard-profile-notice" role="status">
              Your account is signed in, but its saved profile couldn’t be loaded. Apply the Supabase migrations in{" "}
              <code>supabase/migrations</code> to finish setting up the profile table.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
