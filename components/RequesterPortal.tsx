
import React, { useState } from 'react';
import { Plus, FileText, Loader2, Paperclip, BarChart3, Clock, CheckCircle2, X } from 'lucide-react';
import { AutomationRequest, Priority, RequestStatus } from '../types';
import { fileToBase64, createRequest } from '../services/storageService';
import { sendEmailNotification } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';

interface Props {
  requests: AutomationRequest[];
  onRequestCreate: () => void;
  onViewRequest: (req: AutomationRequest) => void;
}

const INITIAL_REQ_STATE = {
  title: '',
  desc: '',
  priority: Priority.MEDIUM,
  project: '',
  revitVersion: '2024',
  dueDate: '',
  files: [] as File[]
};

export const RequesterPortal: React.FC<Props> = ({ requests, onRequestCreate, onViewRequest }) => {
  const { user } = useAuth();
  const [view, setView] = useState<'DASHBOARD' | 'NEW'>('DASHBOARD');
  
  // Filter requests for this user
  const myRequests = requests.filter(r => r.requesterId === user?.id);
  
  // Stats
  const pendingCount = myRequests.filter(r => r.status === RequestStatus.PENDING).length;
  const inProgressCount = myRequests.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
  const completedCount = myRequests.filter(r => r.status === RequestStatus.COMPLETED).length;

  const [newReq, setNewReq] = useState(INITIAL_REQ_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const addedFiles = Array.from(e.target.files);
      setNewReq(prev => ({
        ...prev,
        files: [...prev.files, ...addedFiles] // Append files instead of replacing
      }));
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setNewReq(prev => ({
      ...prev,
      files: prev.files.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleCancel = () => {
    setNewReq(INITIAL_REQ_STATE); // Reset form data
    setView('DASHBOARD');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const attachments = await Promise.all(newReq.files.map(async (f) => ({
        name: f.name,
        type: f.type,
        data: await fileToBase64(f)
      })));

      const request: AutomationRequest = {
        id: `req_${Date.now()}`,
        title: newReq.title,
        description: newReq.desc,
        priority: newReq.priority,
        status: RequestStatus.PENDING,
        requesterName: user?.name || 'Unknown',
        requesterId: user?.id || 'unknown',
        projectName: newReq.project,
        revitVersion: newReq.revitVersion,
        dueDate: newReq.dueDate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attachments
      };

      await createRequest(request);
      
      // Notify Developers via Backend
      await sendEmailNotification({
        subject: `New Automation Request: ${request.title}`,
        body: `A new request has been submitted by ${request.requesterName}.\n\nProject: ${request.projectName}\nPriority: ${request.priority}\n\nPlease check the Developer Portal.`
      });

      onRequestCreate(); 
      setNewReq(INITIAL_REQ_STATE); // Reset form data
      setView('DASHBOARD');
    } catch (err) {
      console.error(err);
      alert('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (view === 'NEW') {
    return (
      <div className="max-w-4xl mx-auto">
         <div className="flex items-center gap-2 mb-6 text-slate-500 text-sm">
            <button onClick={handleCancel} className="hover:text-indigo-600 transition">Dashboard</button>
            <span>/</span>
            <span className="text-slate-900">New Request</span>
         </div>
         
         <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">Submit Automation Request</h2>
            <p className="text-slate-500 mb-8">Provide details about the manual task you want automated.</p>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Request Title</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="e.g., Automatic Room Tagging based on Department"
                    value={newReq.title}
                    onChange={e => setNewReq({...newReq, title: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Project Name</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="e.g. Skyline Tower"
                    value={newReq.project}
                    onChange={e => setNewReq({...newReq, project: e.target.value})}
                    />
                </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Revit Version</label>
                    <select 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    value={newReq.revitVersion}
                    onChange={e => setNewReq({...newReq, revitVersion: e.target.value})}
                    >
                    {['2022', '2023', '2024', '2025'].map(v => <option key={v} value={v}>Revit {v}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Priority Level</label>
                    <select 
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                    value={newReq.priority}
                    onChange={e => setNewReq({...newReq, priority: e.target.value as Priority})}
                    >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Desired Due Date (Optional)</label>
                    <input 
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    value={newReq.dueDate}
                    onChange={e => setNewReq({...newReq, dueDate: e.target.value})}
                    />
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Detailed Description</label>
                    <textarea 
                    required
                    rows={6}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    placeholder="Describe the current workflow, the logic for automation, and specific requirements..."
                    value={newReq.desc}
                    onChange={e => setNewReq({...newReq, desc: e.target.value})}
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Attachments (Screenshots/Sample Files)</label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Paperclip className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition mb-2" />
                                <p className="text-sm text-slate-500">Click to upload files</p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              multiple 
                              onChange={handleFileChange} 
                            />
                        </label>
                    </div>
                    {newReq.files.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {newReq.files.map((f, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-2 rounded-md border border-slate-200">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-slate-400" /> 
                                  <span className="truncate max-w-xs">{f.name}</span>
                                </div>
                                <button 
                                  type="button"
                                  onClick={() => handleRemoveFile(i)}
                                  className="text-slate-400 hover:text-red-500 transition"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    )}
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex justify-center items-center gap-2 font-medium shadow-sm shadow-indigo-200"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Request'}
                </button>
              </div>
            </form>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
                <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Pending Requests</p>
                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-orange-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">In Progress</p>
                <p className="text-2xl font-bold text-slate-900">{inProgressCount}</p>
            </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium">Completed</p>
                <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
            </div>
        </div>
      </div>

      {/* Main Action and List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
            <div>
                <h2 className="text-xl font-bold text-slate-900">Request History</h2>
                <p className="text-sm text-slate-500 mt-1">Track the status of your automation requests.</p>
            </div>
            <button 
            onClick={() => setView('NEW')}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm font-medium"
            >
            <Plus className="w-4 h-4" /> New Request
            </button>
        </div>

        {myRequests.length === 0 ? (
           <div className="text-center py-16">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No requests yet</h3>
              <p className="text-slate-500 mb-6">Start by submitting your first automation idea.</p>
           </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                        <tr>
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">Project</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {myRequests.map(req => (
                            <tr key={req.id} className="hover:bg-slate-50 transition cursor-pointer" onClick={() => onViewRequest(req)}>
                                <td className="px-6 py-4 font-medium text-slate-900">{req.title}</td>
                                <td className="px-6 py-4">{req.projectName}</td>
                                <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
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
                                <td className="px-6 py-4 text-right">
                                    <button className="text-indigo-600 hover:text-indigo-800 font-medium text-xs">View Details</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};
