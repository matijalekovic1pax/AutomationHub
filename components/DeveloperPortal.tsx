
import React, { useMemo, useState } from 'react';
import { Kanban, Clock, LayoutDashboard, List, Search, Building, Filter, ArrowUpDown } from 'lucide-react';
import { AutomationRequest, RequestStatus, Priority } from '../types';

interface Props {
  requests: AutomationRequest[];
  onViewRequest: (req: AutomationRequest) => void;
}

export const DeveloperPortal: React.FC<Props> = ({ requests, onViewRequest }) => {
  const [viewMode, setViewMode] = useState<'BOARD' | 'LIST'>('BOARD');
  const [search, setSearch] = useState('');
  
  // Filtering States
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [sortDate, setSortDate] = useState<'DESC' | 'ASC'>('DESC');

  const uniqueProjects = useMemo(() => {
    return Array.from(new Set(requests.map(r => r.projectName))).sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => 
      r.title.toLowerCase().includes(search.toLowerCase()) || 
      r.requesterName.toLowerCase().includes(search.toLowerCase())
    );

    if (filterPriority !== 'ALL') {
      result = result.filter(r => r.priority === filterPriority);
    }

    if (filterProject !== 'ALL') {
      result = result.filter(r => r.projectName === filterProject);
    }

    // Sort
    result.sort((a, b) => {
      return sortDate === 'DESC' 
        ? b.createdAt - a.createdAt 
        : a.createdAt - b.createdAt;
    });

    return result;
  }, [requests, search, filterPriority, filterProject, sortDate]);

  const stats = {
      total: requests.length,
      pending: requests.filter(r => r.status === RequestStatus.PENDING).length,
      highPriority: requests.filter(r => r.priority === Priority.HIGH || r.priority === Priority.CRITICAL).length,
  };

  // Group requests by status
  const inboxRequests = filteredRequests.filter(r => r.status === RequestStatus.PENDING);
  const progressRequests = filteredRequests.filter(r => r.status === RequestStatus.IN_PROGRESS);
  const completedRequests = filteredRequests.filter(r => r.status === RequestStatus.COMPLETED);
  const rejectedRequests = filteredRequests.filter(r => r.status === RequestStatus.REJECTED);

  const RequestCard: React.FC<{ req: AutomationRequest }> = ({ req }) => (
    <div 
      onClick={() => onViewRequest(req)}
      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-400 cursor-pointer transition flex flex-col gap-2 group relative h-full"
    >
      <div className="flex justify-between items-start">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide ${
            req.priority === Priority.CRITICAL ? 'bg-red-100 text-red-800' :
            req.priority === Priority.HIGH ? 'bg-orange-100 text-orange-800' :
            'bg-slate-100 text-slate-600'
        }`}>
            {req.priority}
        </span>
        <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded">R{req.revitVersion}</span>
      </div>
      <h4 className="font-semibold text-slate-800 leading-snug text-sm line-clamp-2">{req.title}</h4>
      
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
           <Building className="w-3 h-3 text-slate-400" /> 
           <span className="truncate">{req.projectName}</span>
      </div>
      
      <div className="pt-3 border-t border-slate-50 flex items-center justify-between mt-auto">
         <div className="flex items-center gap-1.5">
             <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold uppercase">
                 {req.requesterName.charAt(0)}
             </div>
             <span className="text-xs text-slate-500 truncate max-w-[80px]">{req.requesterName.split(' ')[0]}</span>
         </div>
         {req.dueDate && (
             <span className="text-[10px] text-slate-400">Due {new Date(req.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
         )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col space-y-6 pb-12">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Requests</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold">Inbox (Pending)</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
        </div>
         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 uppercase font-semibold">High Priority</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.highPriority}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
             <p className="text-xs text-slate-500 uppercase font-semibold">Avg Turnaround</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">1.2 Days</p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm gap-3">
          <div className="relative w-full sm:w-auto flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                  type="text" 
                  placeholder="Search requests..." 
                  className="pl-9 pr-4 py-2 text-sm border-none focus:ring-0 w-full text-slate-700 placeholder-slate-400"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
              />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-md w-full sm:w-auto">
              <button 
                  onClick={() => setViewMode('BOARD')}
                  className={`flex-1 sm:flex-none p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition ${viewMode === 'BOARD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <LayoutDashboard className="w-4 h-4" /> Board
              </button>
              <button 
                  onClick={() => setViewMode('LIST')}
                  className={`flex-1 sm:flex-none p-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition ${viewMode === 'LIST' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <List className="w-4 h-4" /> List
              </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm text-sm">
            <div className="flex items-center gap-2 text-slate-500 mr-2">
                <Filter className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase">Filters</span>
            </div>
            
            <select 
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
                <option value="ALL">All Priorities</option>
                <option value={Priority.CRITICAL}>Critical</option>
                <option value={Priority.HIGH}>High</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.LOW}>Low</option>
            </select>

            <select 
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[150px]"
            >
                <option value="ALL">All Projects</option>
                {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <div className="w-px h-5 bg-slate-200 mx-2 hidden sm:block"></div>

            <div className="flex items-center gap-2 text-slate-500 ml-auto sm:ml-0">
                 <ArrowUpDown className="w-4 h-4" />
                 <span className="font-semibold text-xs uppercase">Sort Date</span>
            </div>
             <select 
                value={sortDate}
                onChange={(e) => setSortDate(e.target.value as 'DESC' | 'ASC')}
                className="bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
                <option value="DESC">Newest First</option>
                <option value="ASC">Oldest First</option>
            </select>

            {(filterPriority !== 'ALL' || filterProject !== 'ALL') && (
                <button 
                    onClick={() => { setFilterPriority('ALL'); setFilterProject('ALL'); }}
                    className="ml-auto text-xs text-red-500 hover:text-red-700 font-medium"
                >
                    Clear Filters
                </button>
            )}
        </div>
      </div>
      
      {/* Content Area - Stacked Layout */}
      <div>
        {viewMode === 'BOARD' ? (
             <div className="flex flex-col gap-8">
                {/* 1. INBOX SECTION (Full Row) */}
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-yellow-100 p-1.5 rounded-md shadow-sm">
                             <Clock className="w-4 h-4 text-yellow-700" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg">Inbox</h3>
                        <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">{inboxRequests.length}</span>
                    </div>
                    
                    <div className="bg-slate-100/50 p-6 rounded-xl border border-slate-200 border-dashed">
                        {inboxRequests.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                No pending requests matching filters.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {inboxRequests.map(req => <RequestCard key={req.id} req={req} />)}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PROCESS COLUMNS (Grid Below) */}
                <div>
                     <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                        <Kanban className="w-5 h-5 text-slate-500" /> Workflows
                     </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* In Progress */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-blue-500 pb-2 bg-white px-3 py-2 rounded-t-lg shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm">In Development</h3>
                                <span className="text-xs text-slate-400 font-medium ml-auto bg-slate-100 px-2 py-0.5 rounded-full">{progressRequests.length}</span>
                            </div>
                            <div className="space-y-3">
                                {progressRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {progressRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">No active tasks</div>}
                            </div>
                        </div>

                        {/* Done */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-green-500 pb-2 bg-white px-3 py-2 rounded-t-lg shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm">Done</h3>
                                <span className="text-xs text-slate-400 font-medium ml-auto bg-slate-100 px-2 py-0.5 rounded-full">{completedRequests.length}</span>
                            </div>
                            <div className="space-y-3">
                                {completedRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {completedRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">No completed tasks</div>}
                            </div>
                        </div>

                        {/* Rejected */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-red-500 pb-2 bg-white px-3 py-2 rounded-t-lg shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <h3 className="font-semibold text-slate-800 text-sm">Rejected</h3>
                                <span className="text-xs text-slate-400 font-medium ml-auto bg-slate-100 px-2 py-0.5 rounded-full">{rejectedRequests.length}</span>
                            </div>
                            <div className="space-y-3 opacity-75">
                                {rejectedRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {rejectedRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">No rejected tasks</div>}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
        ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Requester</th>
                                <th className="px-6 py-4">Project</th>
                                <th className="px-6 py-4">Priority</th>
                                <th className="px-6 py-4">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onViewRequest(req)}>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            req.status === RequestStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                            req.status === RequestStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                                            req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{req.title}</td>
                                    <td className="px-6 py-4">{req.requesterName}</td>
                                    <td className="px-6 py-4 text-xs font-mono">{req.projectName}</td>
                                    <td className="px-6 py-4">
                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            req.priority === Priority.CRITICAL ? 'bg-red-100 text-red-800' :
                                            req.priority === Priority.HIGH ? 'bg-orange-100 text-orange-800' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {req.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
