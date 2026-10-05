import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth, useSessionRefresh } from '../features/auth';
import type { Role } from '../shared/domain/role';
import { useTheme, type ThemeChoice } from '../shared/presentation/theme/themeProvider';
import styles from './appShell.module.css';

const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Paciente',
  HEALTH_PROFESSIONAL: 'Profissional de saúde',
  ADMINISTRATOR: 'Administrador',
};

const NAV_ITEMS: Record<Role, { to: string; label: string }[]> = {
  PATIENT: [{ to: '/paciente', label: 'Meu painel' }],
  HEALTH_PROFESSIONAL: [{ to: '/profissional', label: 'Pacientes' }],
  ADMINISTRATOR: [{ to: '/admin', label: 'Plataforma' }],
};

const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

function ThemeSelect() {
  const { choice, setChoice } = useTheme();
  return (
    <select
      className={styles.select}
      aria-label="Tema"
      value={choice}
      onChange={(event) => setChoice(event.target.value as ThemeChoice)}
    >
      {THEME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/**
 * The frame around every signed-in page: the person's name and role, the
 * navigation of their role (a menu below 640 px, RSP-03), the theme choice
 * (RSP-10) and "Sair" (ACC-11). Pages render in the `<Outlet />`. Everything
 * works from the keyboard (RSP-06): a skip link, a menu button that Escape
 * closes, and native buttons and links.
 */
export function AppShell() {
  const { state, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useSessionRefresh();

  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  if (state.status !== 'authenticated') return null;
  const { account } = state.session;

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className={styles.header}>
        <span className={styles.brand}>Glucore</span>
        <button
          ref={menuButton}
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="navegacao"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <nav id="navegacao" className={styles.nav} data-open={menuOpen} aria-label="Principal">
          {NAV_ITEMS[account.role].map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.link} onClick={() => setMenuOpen(false)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.person}>
          <span>{account.fullName}</span>
          <span className={styles.role}>{ROLE_LABELS[account.role]}</span>
        </div>
        <div className={styles.controls}>
          <ThemeSelect />
          <button type="button" className={styles.signOut} onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main id="conteudo" className={styles.content} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
