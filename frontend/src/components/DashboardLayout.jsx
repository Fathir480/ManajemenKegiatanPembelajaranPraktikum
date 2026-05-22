import Sidebar from './Sidebar';

export default function DashboardLayout({ title, children }) {
  return (
    <div className="page-wrapper">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header className="topbar">
          <span className="topbar-title">{title}</span>
        </header>
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
