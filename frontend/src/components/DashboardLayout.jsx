import Sidebar from './Sidebar';
import { getUser } from '../lib/auth';

export default function DashboardLayout({ title, children }) {
  const user = getUser();
  const wrapperClass = `page-wrapper theme-admin`;

  return (
    <div className={wrapperClass}>
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
