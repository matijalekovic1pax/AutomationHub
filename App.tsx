import React, { useState, useEffect } from 'react';
import { Layout, Box, User as UserIcon, LogOut, Code2, Settings, Loader2, Users, FolderOpen, UserCheck } from 'lucide-react';
import { RequesterPortal } from './components/RequesterPortal';
import { DeveloperPortal } from './components/DeveloperPortal';
import { RequestDetail } from './components/RequestDetail';
import { ScriptsLibrary } from './components/ScriptsLibrary';
import { ScriptLibraryWithFolders } from './components/ScriptLibraryWithFolders';
import { SettingsPage } from './components/SettingsPage';
import { UserManagement } from './components/UserManagement';
import { RegistrationManagement } from './components/RegistrationManagement';
import { Login } from './components/Login';
import { Registration } from './components/Registration';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { getRequests } from './services/storageService';
import { apiClient } from './services/apiClient';
import { AutomationRequest, DEVELOPER_ROLE } from './types';

type PageView = 'DASHBOARD' | 'LIBRARY' | 'SETTINGS' | 'USERS' | 'REGISTRATIONS';

const AppContent: React.FC = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [selectedRequest, setSelectedRequest] = useState<AutomationRequest | null>(null);
  const [requests, setRequests] = useState<AutomationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  const [currentView, setCurrentView] = useState<PageView>('DASHBOARD');
  const [showRegistration, setShowRegistration] = useState(false);
  const [pendingRegCount, setPendingRegCount] = useState(0);
  const [lastSeenPendingRequests, setLastSeenPendingRequests] = useState(0);
  const [lastSeenPendingRegs, setLastSeenPendingRegs] = useState(0);
  const [lastSeenTotalRequests, setLastSeenTotalRequests] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoadingRequests(true);
      try {
        const data = await getRequests();
        setRequests(data);
      } catch (e) {
        console.error("Failed to load requests from backend", e);
      } finally {
        setLoadingRequests(false);
      }
    };
    fetchData();
  }, [user, refreshTrigger, pollTick]);

  // Poll for new requests periodically to refresh developer view
  useEffect(() => {
    if (!user || user.role !== DEVELOPER_ROLE) return;
    const id = setInterval(() => setPollTick((t) => t + 1), 10000);
    return () => clearInterval(id);
  }, [user]);

  const pendingRequestCount = requests.filter(r => r.status === 'PENDING').length;
  const newRequestsSinceSeen = Math.max(0, requests.length - lastSeenTotalRequests);

  useEffect(() => {
    if (!user) return;
    if (currentView === 'DASHBOARD' && user.role === DEVELOPER_ROLE) {
      setLastSeenPendingRequests(pendingRequestCount);
      setLastSeenTotalRequests(requests.length);
    }
    if (currentView === 'REGISTRATIONS' && user.role === DEVELOPER_ROLE) {
      setLastSeenPendingRegs(pendingRegCount);
    }
  }, [currentView, user, pendingRequestCount, pendingRegCount]);

  useEffect(() => {
    const loadPendingRegistrations = async () => {
      if (!user || user.role !== DEVELOPER_ROLE) {
        setPendingRegCount(0);
        return;
      }
      try {
        const regs = await apiClient.get('/registration-requests');
        const pending = Array.isArray(regs) ? regs.filter((r: any) => r.status === 'PENDING').length : 0;
        setPendingRegCount(pending);
      } catch (e) {
        console.error('Failed to fetch registration requests count', e);
      }
    };
    loadPendingRegistrations();
  }, [user, refreshTrigger]);

  const refreshRequests = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600"/>
      </div>
    );
  }

  if (!user) {
    if (showRegistration) {
      return <Registration onBackToLogin={() => setShowRegistration(false)} />;
    }
    return <Login onShowRegistration={() => setShowRegistration(true)} />;
  }

  const handleLogout = () => {
    logout();
    setSelectedRequest(null);
    setCurrentView('DASHBOARD');
  };

  const renderMainContent = () => {
    if (currentView === 'SETTINGS') {
      return <SettingsPage />;
    }

    if (currentView === 'LIBRARY') {
      return <ScriptLibraryWithFolders requests={requests} onViewRequest={(req) => {
        setSelectedRequest(req);
        setCurrentView('DASHBOARD');
      }} />;
    }

    if (currentView === 'USERS') {
      return <UserManagement />;
    }

    if (currentView === 'REGISTRATIONS') {
      return <RegistrationManagement />;
    }

    if (selectedRequest) {
      return (
        <RequestDetail 
          request={selectedRequest}
          isDeveloper={user.role === DEVELOPER_ROLE}
          onBack={() => setSelectedRequest(null)}
          onUpdate={() => {
            refreshRequests();
            getRequests().then(all => {
              const fresh = all.find(r => r.id === selectedRequest.id);
              if (fresh) setSelectedRequest(fresh);
            });
          }}
        />
      );
    }

    if (loadingRequests && requests.length === 0) {
      return (
        <div className="flex h-64 items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin"/> Loading requests...
        </div>
      );
    }

    if (user.role === DEVELOPER_ROLE) {
      return (
        <DeveloperPortal 
          requests={requests}
          onViewRequest={setSelectedRequest}
        />
      );
    } else {
      return (
        <RequesterPortal 
          requests={requests} 
          onRequestCreate={refreshRequests}
          onViewRequest={setSelectedRequest}
        />
      );
    }
  };

  return (
    <div className={`h-screen ${isDark ? 'dark' : ''} bg-slate-50 dark:bg-slate-950 flex overflow-hidden`}>
      <aside className="w-64 bg-slate-900 dark:bg-slate-950 text-slate-300 flex flex-col flex-shrink-0 h-full border-r border-slate-800 dark:border-slate-900 z-20">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 dark:border-slate-900 flex-shrink-0">
          <div className="bg-indigo-600 p-1.5 rounded-lg">
            <Box className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight">
            Automation <span className="text-indigo-400">Hub</span>
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Menu</div>
          
          <button 
            onClick={() => { setSelectedRequest(null); setCurrentView('DASHBOARD'); setLastSeenPendingRequests(pendingRequestCount); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentView === 'DASHBOARD' && !selectedRequest ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'}`}
          >
            <Layout className="w-4 h-4" />
            <span className="font-medium">Dashboard</span>
            {user.role === DEVELOPER_ROLE && pendingRequestCount > lastSeenPendingRequests && (
              <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-yellow-500 text-slate-900">
                {pendingRequestCount - lastSeenPendingRequests}
              </span>
            )}
            {user.role === DEVELOPER_ROLE && newRequestsSinceSeen > 0 && (
              <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white">
                +{newRequestsSinceSeen}
              </span>
            )}
          </button>
          
          <button 
            onClick={() => { setSelectedRequest(null); setCurrentView('LIBRARY'); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentView === 'LIBRARY' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'}`}
          >
            <FolderOpen className="w-4 h-4" />
            <span className="font-medium">Script Library</span>
          </button>
          
          {user.role === DEVELOPER_ROLE && (
            <>
              <button 
                onClick={() => { setSelectedRequest(null); setCurrentView('USERS'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentView === 'USERS' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'}`}
              >
                <Users className="w-4 h-4" />
                <span className="font-medium">User Management</span>
              </button>
              
              <button 
                onClick={() => { setSelectedRequest(null); setCurrentView('REGISTRATIONS'); setLastSeenPendingRegs(pendingRegCount); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentView === 'REGISTRATIONS' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'}`}
              >
                <UserCheck className="w-4 h-4" />
                <span className="font-medium">Registrations</span>
                {pendingRegCount > lastSeenPendingRegs && (
                  <span className="ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">
                    {pendingRegCount - lastSeenPendingRegs}
                  </span>
                )}
              </button>
            </>
          )}

          <button 
            onClick={() => { setSelectedRequest(null); setCurrentView('SETTINGS'); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${currentView === 'SETTINGS' ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-white'}`}
          >
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-800 dark:border-slate-900 bg-slate-900/50 dark:bg-slate-950/50 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-600" />
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {user.companyRole || (user.role === DEVELOPER_ROLE ? 'Developer' : 'Employee')}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 text-sm font-medium transition text-white border border-slate-700 dark:border-slate-800"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {renderMainContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
