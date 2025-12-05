
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

  const activeStatuses = new Set([RequestStatus.PENDING, RequestStatus.IN_PROGRESS, RequestStatus.RETURNED]);
  const completedForStats = requests.filter(r => r.status === RequestStatus.COMPLETED);
  const avgTurnaroundDays = completedForStats.length
    ? (completedForStats.reduce((acc, r) => acc + Math.max(0, r.updatedAt - r.createdAt), 0) / completedForStats.length) / (1000 * 60 * 60 * 24)
    : 0;
  const stats = {
      total: requests.length,
      pending: requests.filter(r => r.status === RequestStatus.PENDING).length,
      highPriority: requests.filter(r => activeStatuses.has(r.status) && (r.priority === Priority.HIGH || r.priority === Priority.CRITICAL)).length,
      avgTurnaround: avgTurnaroundDays,
  };

  const priorityRank: Record<Priority, number> = {
    [Priority.CRITICAL]: 3,
    [Priority.HIGH]: 2,
    [Priority.MEDIUM]: 1,
    [Priority.LOW]: 0,
  };

  // Group requests by status
  const inboxRequests = filteredRequests
    .filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.RETURNED)
    .slice()
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
  const progressRequests = filteredRequests.filter(r => r.status === RequestStatus.IN_PROGRESS);
  const completedRequests = filteredRequests.filter(r => r.status === RequestStatus.COMPLETED);
  const rejectedRequests = filteredRequests.filter(r => r.status === RequestStatus.REJECTED);

  const RequestCard: React.FC<{ req: AutomationRequest }> = ({ req }) => {
    const submissionCount = req.submissionCount ?? (req as any).submissionEvents?.length ?? 0;
    return (
      <div 
        onClick={() => onViewRequest(req)}
        className="bg-white dark:bg-slate-800/80 px-3 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition flex flex-col gap-1 group relative"
      >
        <div className="flex justify-between items-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide leading-none ${
              req.priority === Priority.CRITICAL ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
              req.priority === Priority.HIGH ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
              'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200'
          }`}>
              {req.priority}
          </span>
          <div className="flex items-center gap-1">
            {req.status === RequestStatus.RETURNED && (
              <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200 px-2 py-0.5 rounded-full border border-orange-200 dark:border-orange-800 font-semibold">
                Returned
              </span>
            )}
            <span className="text-[10px] text-slate-500 dark:text-slate-300 font-mono bg-slate-50 dark:bg-slate-700/60 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-600 leading-none">R{req.revitVersion}</span>
          </div>
        </div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100 leading-tight text-sm line-clamp-1">{req.title}</h4>
        
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-300">
          <div className="flex items-center gap-1 min-w-0">
            <Building className="w-3 h-3 text-slate-400 dark:text-slate-500" /> 
            <span className="truncate">{req.projectName}</span>
          </div>
          {req.dueDate && (
            <span className="text-[10px] text-slate-400 dark:text-slate-300 ml-2 shrink-0">Due {new Date(req.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
          )}
        </div>
        
        <div className="pt-1 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[11px]">
           <div className="flex items-center gap-1">
               <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-200 flex items-center justify-center text-[10px] font-bold uppercase">
                   {req.requesterName.charAt(0)}
               </div>
               <span className="text-[11px] text-slate-500 dark:text-slate-300 truncate max-w-[80px]">{req.requesterName.split(' ')[0]}</span>
           </div>
           {submissionCount > 1 && (
              <span className="text-[10px] text-orange-500 dark:text-orange-300 font-semibold">
                Resubmitted x{submissionCount - 1}
              </span>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-6 pb-12 text-slate-900 dark:text-slate-100">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Total Requests</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Inbox (Pending)</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{stats.pending}</p>
        </div>
         <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">High Priority</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.highPriority}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
             <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">Avg Turnaround</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">
              {stats.avgTurnaround ? `${stats.avgTurnaround.toFixed(1)} Days` : '—'}
            </p>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm gap-3">
          <div className="relative w-full sm:w-auto flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input 
                  type="text" 
                  placeholder="Search requests..." 
                  className="pl-9 pr-4 py-2 text-sm border-none focus:ring-0 w-full text-slate-700 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 bg-transparent"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
              />
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-md w-full sm:w-auto border border-slate-200 dark:border-slate-700">
              <button 
                  onClick={() => setViewMode('BOARD')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition ${viewMode === 'BOARD' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'}`}
              >
                  <LayoutDashboard className="w-4 h-4" /> Board
              </button>
              <button 
                  onClick={() => setViewMode('LIST')}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white'}`}
              >
                  <List className="w-4 h-4" /> List
              </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-300 mr-2">
                <Filter className="w-4 h-4" />
                <span className="font-semibold text-xs uppercase">Filters</span>
            </div>
            
            <select 
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
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
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none max-w-[150px]"
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
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
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
                        <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1.5 rounded-md shadow-sm">
                             <Clock className="w-4 h-4 text-yellow-700 dark:text-yellow-300" />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-lg">Inbox</h3>
                        <span className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">{inboxRequests.length}</span>
                    </div>
                    
                    <div className="bg-slate-100/50 dark:bg-slate-900/40 p-6 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                        {inboxRequests.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                No pending requests matching filters.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {inboxRequests.map(req => <RequestCard key={req.id} req={req} />)}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. PROCESS COLUMNS (Grid Below) */}
                <div>
                     <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-4 flex items-center gap-2">
                        <Kanban className="w-5 h-5 text-slate-500" /> Workflows
                     </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* In Progress */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-blue-500 pb-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-t-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">In Development</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-300 font-medium ml-auto bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{progressRequests.length}</span>
                            </div>
                            <div className="space-y-2.5">
                                {progressRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {progressRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">No active tasks</div>}
                            </div>
                        </div>

                        {/* Done */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-green-500 pb-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-t-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Done</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-300 font-medium ml-auto bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{completedRequests.length}</span>
                            </div>
                            <div className="space-y-2.5">
                                {completedRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {completedRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">No completed tasks</div>}
                            </div>
                        </div>

                        {/* Rejected */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 border-b-2 border-red-500 pb-2 bg-white dark:bg-slate-900 px-3 py-2 rounded-t-lg shadow-sm border border-slate-200 dark:border-slate-700">
                                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Rejected</h3>
                                <span className="text-xs text-slate-500 dark:text-slate-300 font-medium ml-auto bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">{rejectedRequests.length}</span>
                            </div>
                            <div className="space-y-2.5 opacity-90">
                                {rejectedRequests.map(req => <RequestCard key={req.id} req={req} />)}
                                {rejectedRequests.length === 0 && <div className="h-24 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">No rejected tasks</div>}
                            </div>
                        </div>
                    </div>
                </div>
             </div>
        ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Requester</th>
                                <th className="px-6 py-4">Project</th>
                                <th className="px-6 py-4">Priority</th>
                                <th className="px-6 py-4">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer" onClick={() => onViewRequest(req)}>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            req.status === RequestStatus.COMPLETED ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                            req.status === RequestStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' :
                                            req.status === RequestStatus.RETURNED ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200' :
                                            req.status === RequestStatus.REJECTED ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200' :
                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200'
                                        }`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{req.title}</td>
                                    <td className="px-6 py-4">{req.requesterName}</td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-500 dark:text-slate-300">{req.projectName}</td>
                                    <td className="px-6 py-4">
                                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            req.priority === Priority.CRITICAL ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' :
                                            req.priority === Priority.HIGH ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
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
