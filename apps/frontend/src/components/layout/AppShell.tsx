import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/providers/AuthProvider';
import { api } from '../../lib/apiClient';
import { useOnlineStatus } from '../../lib/onlineStatus';

const tabs = [
  { to: 'search', label: 'Recherche' },
  { to: 'demandes', label: 'Demandes', badgeKey: 'leads' as const },
  { to: 'map', label: 'Carte' },
  { to: 'dashboard', label: 'Profil' },
];

type LeadsBadgeResponse = { summary: { badgeCount: number } };

function tabClassName({ isActive }: { isActive: boolean }) {
  return `app-tab${isActive ? ' app-tab--active' : ''}`;
}

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const { data: leadsBadge } = useQuery({
    queryKey: ['leads-badge', profile?.id],
    queryFn: () => api.get<LeadsBadgeResponse>('/api/leads?includeArchived=false'),
    enabled: !!profile,
    refetchInterval: 60_000,
  });
  const badgeCount = leadsBadge?.summary.badgeCount ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <header className="header" style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>LogiGo Agent</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>{profile?.nom}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`user-badge ${isAdmin ? 'badge-admin' : 'badge-agent'}`} style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
            {isAdmin ? 'Admin' : 'Agent'} · {profile?.nom}
          </span>
          <button className="btn-secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => void signOut()}>Quitter</button>
        </div>
      </header>
      <nav className={`tabs app-tabs${isAdmin ? ' app-tabs--admin' : ''}`}>
        {tabs.map((tab) => {
          const showBadge = tab.badgeKey === 'leads' && badgeCount > 0;
          return (
            <NavLink key={tab.to} to={tab.to} className={tabClassName}>
              <span className={`app-tab__label${showBadge ? ' app-tab__label--with-badge' : ''}`}>
                {showBadge && (
                  <span className="app-tab__badge app-tab__badge--spacer" aria-hidden="true">
                    {badgeCount}
                  </span>
                )}
                <span className="app-tab__text">{tab.label}</span>
                {showBadge && <span className="app-tab__badge">{badgeCount}</span>}
              </span>
            </NavLink>
          );
        })}
        {isAdmin && (
          <>
            <NavLink to="admin/listings/new" className={tabClassName}>
              <span className="app-tab__label">
                <span className="app-tab__text">Ajouter Logement</span>
              </span>
            </NavLink>
            <NavLink to="admin" end className={tabClassName}>
              <span className="app-tab__label">
                <span className="app-tab__text">Gestion</span>
              </span>
            </NavLink>
          </>
        )}
      </nav>
      {!isOnline && (
        <div className="offline-banner" role="status">
          Connexion indisponible. Les actions sensibles sont bloquées jusqu’au retour en ligne.
        </div>
      )}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
}
