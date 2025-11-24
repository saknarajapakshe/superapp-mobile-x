
import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { UserRole } from './types';

// Views
import { CalendarView } from './views/CalendarView';
import { CatalogView } from './views/CatalogView';
import { AdminView } from './views/AdminView';
import { ProfileView } from './views/ProfileView';
import { BookingView } from './views/BookingView';
import { PageLoader, Button } from './components/UI';
import { BottomNav, Header } from './components/Layout';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const AppContent = () => {
  const { currentUser, isLoading, error, refreshData } = useApp();
  const [currentTab, setCurrentTab] = useState('calendar');
  const [selectedResource, setSelectedResource] = useState<any>(null);

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Connection Failed</h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs">
          {error}.<br/>Please ensure the backend server is running on port 3001.
        </p>
        <Button onClick={refreshData} variant="primary">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Booking Flow Overlay
  if (selectedResource) {
    return (
      <BookingView 
        resource={selectedResource} 
        onBack={() => setSelectedResource(null)} 
        onSuccess={() => {
           setSelectedResource(null);
           setCurrentTab('calendar');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900">
      
      {/* Conditional Headers */}
      {currentTab === 'calendar' && <Header title="My Schedule" subtitle="Upcoming Bookings" />}
      {currentTab === 'catalog' && <Header title="Resource Catalog" subtitle="Find & Book" />}
      {currentTab === 'admin' && <Header title="Admin Dashboard" subtitle="Management & Analytics" />}
      {currentTab === 'profile' && <Header title="Profile" subtitle="Account & Debug" />}

      {/* Main Content - Scrollable Area */}
      <main className="flex-1 overflow-y-auto p-4 pb-24 max-w-md mx-auto w-full animate-in fade-in">
        {currentTab === 'calendar' && <CalendarView />}
        {currentTab === 'catalog' && <CatalogView onSelect={setSelectedResource} />}
        {currentTab === 'admin' && isAdmin && <AdminView />}
        {currentTab === 'profile' && <ProfileView />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav 
        activeTab={currentTab} 
        onTabChange={setCurrentTab} 
        showAdmin={isAdmin} 
      />
    </div>
  );
};

const App = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
