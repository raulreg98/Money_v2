import { useState } from 'react';
import { AppLayout, type PageId } from '@/components/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardPage } from '@/pages/DashboardPage';
import { PortfolioPage } from '@/pages/PortfolioPage';
import { AccountsPage } from '@/pages/AccountsPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { CategoriesPage } from '@/pages/CategoriesPage';

function AppContent() {
  const [page, setPage] = useState<PageId>('dashboard');

  const handleNavigate = (p: PageId) => {
    setPage(p);
  };

  return (
    <AppLayout current={page} onNavigate={handleNavigate}>
      <ErrorBoundary key={page}>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'portfolio' && <PortfolioPage />}
        {page === 'accounts' && <AccountsPage />}
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
      <AppContent />
    </ErrorBoundary>
  );
}
