export function LoadingSpinner({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div className="empty">
      <div style={{ width: 32, height: 32, border: '3px solid var(--border2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 12px' }} />
      <div>{label}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
