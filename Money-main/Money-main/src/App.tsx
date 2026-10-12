import { useState } from 'react';
import { AppLayout, type PageId } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardPage } from '@/pages/DashboardPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';
import { CategoryProvider } from '@/context/CategoryContext';

function AppContent() {
  const [page, setPage] = useState<PageId>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const handleNavigate = (p: PageId, accountId?: number) => {
    setPage(p);
    if (accountId !== undefined) {
      setSelectedAccountId(accountId);
    } else {
      setSelectedAccountId(null);
    }
  };

  return (
    <AppLayout current={page} onNavigate={handleNavigate}>
      <ErrorBoundary key={`${page}-${selectedAccountId}`}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'portfolio' && <PortfolioPage />}
        {page === 'accounts' && <AccountsPage initialAccountId={selectedAccountId} />}
        {page === 'categories' && <CategoriesPage />}
        {page === 'charts' && <ChartsPage />}
        {page === 'settings' && <SettingsPage />}
      </ErrorBoundary>
    </AppLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CategoryProvider>
        <AppContent />
      </CategoryProvider>
    </ErrorBoundary>
  );
}
