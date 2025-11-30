
import React, { useState, useEffect } from 'react';
import { Layout, Box, User as UserIcon, LogOut, Code2, Settings, Loader2 } from 'lucide-react';
import { RequesterPortal } from './components/RequesterPortal';
import { DeveloperPortal } from './components/DeveloperPortal';
import { RequestDetail } from './components/RequestDetail';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getRequests } from './services/storageService';
import { AutomationRequest, UserRole } from './types';

const AppContent: React.FC = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<AutomationRequest | null>(null);
  const [requests, setRequests] = useState<AutomationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoadingRequests(true);
      try {
        const data = await getRequests();
        setRequests(data);
      } catch(e) {
          console.error("Failed to fetch requests", e);
      } finally {
        setLoadingRequests(false);
      }
    };
    fetchData();
  }, [user, refreshTrigger]);

  const refreshRequests = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (authLoading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-indigo-600"/></div>;
  }

  if (!user) {
    return <Login />;
  }

  const handleLogout = () => {
    logout();
    setSelectedRequest(null);
  };

  const renderMainContent = () => {
    if (selectedRequest) {
      return (
        <RequestDetail 
          request={selectedRequest}
          isDeveloper={user.role === UserRole.DEVELOPER}
          onBack={() => setSelectedRequest(null)}
          onUpdate={() => {
            refreshRequests();
            // Re-fetch the specific request to get latest state
            getRequests().then(all => {
                 const fresh = all.find(r => r.id === selectedRequest.id);
                 if (fresh) setSelectedRequest(fresh);
            });
          }}
        />
      );
    }

    if (loadingRequests && requests.length === 0) {
        return <div className="flex h-64 items-center justify-center text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin"/> Loading requests...</div>;
    }

    if (user.role === UserRole.ARCHITECT) {
      return (
        <RequesterPortal 
          requests={requests} 
          onRequestCreate={refreshRequests}
          onViewRequest={setSelectedRequest}
        />
      );
    } else {
      return (
        <DeveloperPortal 
          requests={requests}
          onViewRequest={setSelectedRequest}
        />
      );
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 h-full border-r border-slate-800 z-20">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 flex-shrink-0">
             <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Box className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">Revit<span className="text-indigo-400">Hub</span></span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Menu</div>
            <button 
                onClick={() => setSelectedRequest(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${!selectedRequest ? 'bg-indigo-600/10 text-indigo-400' : 'hover:bg-slate-800 hover:text-white'}`}
            >
                <Layout className="w-4 h-4" />
                <span className="font-medium">Dashboard</span>
            </button>
            {user.role === UserRole.DEVELOPER && (
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition">
                    <Code2 className="w-4 h-4" />
                    <span className="font-medium">Scripts Library</span>
                </button>
            )}
             <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white transition">
                <Settings className="w-4 h-4" />
                <span className="font-medium">Settings</span>
            </button>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
            <div className="flex items-center gap-3 mb-4 px-2">
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-slate-600" />
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.role === UserRole.DEVELOPER ? 'Lead Automation Eng.' : 'Architect'}</p>
                </div>
            </div>
            <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-medium transition text-white border border-slate-700"
            >
                <LogOut className="w-4 h-4" /> Sign Out
            </button>
        </div>
      </aside>

      {/* Main Area */}
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
