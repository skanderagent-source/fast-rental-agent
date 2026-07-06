import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/providers/AuthProvider';
import { api } from '../../lib/apiClient';

const tabs = [
  { to: 'search', label: 'Recherche' },
  { to: 'demandes', label: 'Demandes', badgeKey: 'leads' as const },
  { to: 'map', label: 'Carte' },
  { to: 'dashboard', label: 'Profil' },
];

type LeadsBadgeResponse = { summary: { badgeCount: number } };

export function AppShell() {
  const { profile, isAdmin, signOut } = useAuth();
  const { data: leadsBadge } = useQuery({
    queryKey: ['leads-badge'],
    queryFn: () => api.get<LeadsBadgeResponse>('/api/leads?includeArchived=false'),
    enabled: isAdmin,
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
      <nav className="tabs" style={{ display: 'flex', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} style={({ isActive }) => ({
            flex: 1, padding: '10px 4px', fontSize: 11, textAlign: 'center', textDecoration: 'none',
            color: isActive ? 'var(--blue)' : 'var(--text3)',
            borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent',
            position: 'relative',
          })}>
            {tab.label}
            {tab.badgeKey === 'leads' && isAdmin && badgeCount > 0 && (
              <span style={{
                marginLeft: 4, background: 'var(--red)', color: '#fff', borderRadius: 10,
                padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>{badgeCount}</span>
            )}
          </NavLink>
        ))}
        {isAdmin && (
          <>
            <NavLink to="admin/listings/new" style={({ isActive }) => ({ flex: 1, padding: '10px 4px', fontSize: 11, textAlign: 'center', textDecoration: 'none', color: isActive ? 'var(--blue)' : 'var(--text3)', borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent' })}>Ajouter</NavLink>
            <NavLink to="admin" style={({ isActive }) => ({ flex: 1, padding: '10px 4px', fontSize: 11, textAlign: 'center', textDecoration: 'none', color: isActive ? 'var(--blue)' : 'var(--text3)', borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent' })}>Admin</NavLink>
          </>
        )}
      </nav>
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </main>
    </div>
  );
}
