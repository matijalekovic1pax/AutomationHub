import React, { useMemo, useState } from 'react';
import { Search, Code, FileCode, Calendar, Download, Building, ArrowRight } from 'lucide-react';
import { AutomationRequest, RequestStatus } from '../types';

interface Props {
  requests: AutomationRequest[];
  onViewRequest: (req: AutomationRequest) => void;
}

export const ScriptsLibrary: React.FC<Props> = ({ requests, onViewRequest }) => {
  const [search, setSearch] = useState('');

  // Filter only completed requests
  const scripts = useMemo(() => {
    return requests
      .filter(r => r.status === RequestStatus.COMPLETED && r.resultScript)
      .filter(r => 
        r.title.toLowerCase().includes(search.toLowerCase()) || 
        r.description.toLowerCase().includes(search.toLowerCase()) ||
        r.resultFileName?.toLowerCase().includes(search.toLowerCase())
      );
  }, [requests, search]);

  const handleDownload = (e: React.MouseEvent, req: AutomationRequest) => {
    e.stopPropagation();
    if (!req.resultScript) return;
    
    const element = document.createElement("a");
    const file = new Blob([req.resultScript], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = req.resultFileName || `${req.title.replace(/\s+/g, '_')}.py`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Scripts Library</h1>
            <p className="text-slate-500 mt-1">Browse and reuse automation scripts developed for previous requests.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search scripts..." 
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full md:w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scripts.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <FileCode className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No scripts found</h3>
              <p className="text-slate-500">Completed automation requests will appear here.</p>
            </div>
          ) : (
            scripts.map(req => (
              <div 
                key={req.id} 
                onClick={() => onViewRequest(req)}
                className="bg-white border border-slate-200 rounded-lg p-5 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group flex flex-col h-full"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded">
                    Revit {req.revitVersion}
                  </span>
                </div>
                
                <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">{req.title}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-3 flex-1">{req.description}</p>
                
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pt-4 border-t border-slate-50">
                   <div className="flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[100px]">{req.projectName}</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{new Date(req.updatedAt).toLocaleDateString()}</span>
                   </div>
                </div>

                <button 
                  onClick={(e) => handleDownload(e, req)}
                  className="w-full mt-auto bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download .py
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};