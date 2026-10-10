import { type ReactNode, useState } from 'react';
import { LayoutDashboard, Briefcase, Wallet, BarChart3, Settings, Menu, X, TrendingUp, FolderTree } from 'lucide-react';

export type PageId = 'dashboard' | 'portfolio' | 'accounts' | 'categories' | 'charts' | 'settings';

interface LayoutProps {
  current: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Inversiones', icon: Briefcase },
  { id: 'accounts', label: 'Cuentas', icon: Wallet },
  { id: 'categories', label: 'Categorías', icon: FolderTree },
  { id: 'charts', label: 'Gráficas', icon: BarChart3 },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export function AppLayout({ current, onNavigate, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageId) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 flex-col bg-slate-900 border-r border-slate-800 fixed inset-y-0 left-0 z-30">
        <SidebarContent current={current} onNavigate={handleNav} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-50 md:hidden">
            <SidebarContent current={current} onNavigate={handleNav} />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        <header className="md:hidden sticky top-0 z-20 bg-slate-900 border-b border-slate-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-300 hover:text-white">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-white font-semibold">Mi Patrimonio</span>
          <div className="w-6" />
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  current,
  onNavigate,
}: {
  current: PageId;
  onNavigate: (p: PageId) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
          <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Mi Patrimonio</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              current === id
                ? 'bg-blue-600/15 text-blue-400'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <span className="text-slate-500 text-xs px-3">Uso local</span>
      </div>
    </div>
  );
}
