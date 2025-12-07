
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
  files: [] as File[],
  submissionCount: 0
};

export const RequesterPortal: React.FC<Props> = ({ requests, onRequestCreate, onViewRequest }) => {
  const { user } = useAuth();
  const [view, setView] = useState<'DASHBOARD' | 'NEW'>('DASHBOARD');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  
  const currentUserId = user?.id !== undefined && user?.id !== null ? String(user.id) : null;
  // Filter requests for this user
  const myRequests = currentUserId ? requests.filter(r => r.requesterId === currentUserId) : [];

  // Stats
  const pendingCount = myRequests.filter(r => r.status === RequestStatus.PENDING).length;
  const inProgressCount = myRequests.filter(r => r.status === RequestStatus.IN_PROGRESS).length;
  const completedCount = myRequests.filter(r => r.status === RequestStatus.COMPLETED).length;
  const awaitingRequests = myRequests.filter(r => r.status !== RequestStatus.COMPLETED);
  const doneRequests = myRequests.filter(r => r.status === RequestStatus.COMPLETED);

  const [newReq, setNewReq] = useState(INITIAL_REQ_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});

  const previewKey = (file: File) => `${file.name}_${file.lastModified}`;
  const shouldPreview = (file: File) => file.type.startsWith('image/') || file.type === 'application/pdf';

  const resetForm = () => {
    setNewReq(INITIAL_REQ_STATE);
    Object.values(filePreviews).forEach(url => URL.revokeObjectURL(url));
    setFilePreviews({});
  };

  const priorityClasses = (p: Priority) => {
    if (p === Priority.CRITICAL) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200';
    if (p === Priority.HIGH) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200';
    if (p === Priority.MEDIUM) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-200';
    return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const addedFiles = Array.from(e.target.files);
      const previews: Record<string, string> = {};
      addedFiles.forEach(file => {
        if (shouldPreview(file)) {
          previews[previewKey(file)] = URL.createObjectURL(file);
        }
      });

      setFilePreviews(prev => ({ ...prev, ...previews }));
      setNewReq(prev => ({
        ...prev,
        files: [...prev.files, ...addedFiles] // Append files instead of replacing
      }));
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setNewReq(prev => {
      const fileToRemove = prev.files[indexToRemove];
      if (fileToRemove) {
        const key = previewKey(fileToRemove);
        const url = filePreviews[key];
        if (url) URL.revokeObjectURL(url);
        const nextPreviews = { ...filePreviews };
        delete nextPreviews[key];
        setFilePreviews(nextPreviews);
      }
      return {
        ...prev,
        files: prev.files.filter((_, index) => index !== indexToRemove)
      };
    });
  };

  const handleCancel = () => {
    resetForm(); // Reset form data
    setView('DASHBOARD');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const nextSubmissionCount = (newReq.submissionCount || 0) + 1;
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
        requesterId: currentUserId || 'unknown',
        projectName: newReq.project,
        revitVersion: newReq.revitVersion,
        dueDate: newReq.dueDate,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        attachments
      };
      request.submissionCount = nextSubmissionCount;

      await createRequest(request);
      
      // Notify Developers via Backend
      await sendEmailNotification({
        subject: `New Automation Request: ${request.title}`,
        body: `A new request has been submitted by ${request.requesterName}.\n\nProject: ${request.projectName}\nPriority: ${request.priority}\n\nPlease check the Developer Portal.`
      });

      onRequestCreate(); 
      resetForm(); // Reset form data
      setView('DASHBOARD');
      setHasSubmitted(true);
      setNewReq(INITIAL_REQ_STATE);
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
         <div className="flex items-center gap-2 mb-6 text-slate-500 dark:text-slate-300 text-sm">
            <button onClick={handleCancel} className="hover:text-indigo-600 transition">Dashboard</button>
            <span>/</span>
            <span className="text-slate-900 dark:text-white">New Request</span>
         </div>
         
         <div className="bg-white dark:bg-slate-900 p-8 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Submit Automation Request</h2>
            <p className="text-slate-500 dark:text-slate-300 mb-8">Provide details about the manual task you want automated.</p>
            
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Request Title</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="e.g., Automatic Room Tagging based on Department"
                    value={newReq.title}
                    onChange={e => setNewReq({...newReq, title: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Project Name</label>
                    <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="e.g. Skyline Tower"
                    value={newReq.project}
                    onChange={e => setNewReq({...newReq, project: e.target.value})}
                    />
                </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Revit Version</label>
                    <select 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={newReq.revitVersion}
                    onChange={e => setNewReq({...newReq, revitVersion: e.target.value})}
                    >
                    {['2022', '2023', '2024', '2025'].map(v => <option key={v} value={v}>Revit {v}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Priority Level</label>
                    <select 
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={newReq.priority}
                    onChange={e => setNewReq({...newReq, priority: e.target.value as Priority})}
                    >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                 <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Desired Due Date (Optional)</label>
                    <input 
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    value={newReq.dueDate}
                    onChange={e => setNewReq({...newReq, dueDate: e.target.value})}
                    />
                </div>
                
                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Detailed Description</label>
                    <textarea 
                    required
                    rows={6}
                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="Describe the current workflow, the logic for automation, and specific requirements..."
                    value={newReq.desc}
                    onChange={e => setNewReq({...newReq, desc: e.target.value})}
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Attachments (Screenshots/Sample Files)</label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Paperclip className="w-8 h-8 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition mb-2" />
                                <p className="text-sm text-slate-500 dark:text-slate-300">Click to upload files</p>
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
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {newReq.files.map((f, i) => {
                          const key = previewKey(f);
                          const previewUrl = filePreviews[key];
                          const ext = f.name.includes('.') ? f.name.split('.').pop()?.toUpperCase() : '';
                          const isImage = f.type.startsWith('image/');
                          const isPdf = f.type === 'application/pdf';
                          return (
                            <div key={key} className="relative border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
                              <button 
                                type="button"
                                onClick={() => handleRemoveFile(i)}
                                className="absolute top-2 right-2 bg-white/80 hover:bg-red-50 border border-slate-200 rounded-full p-1 text-slate-500 hover:text-red-600 transition"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="h-32 bg-slate-50 flex items-center justify-center">
                                {isImage && previewUrl ? (
                                  <img src={previewUrl} alt={f.name} className="h-full w-full object-cover" />
                                ) : isPdf && previewUrl ? (
                                  <object data={previewUrl} type={f.type} className="h-full w-full" aria-label={f.name}>
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                      <FileText className="w-4 h-4" /> PDF preview unavailable
                                    </div>
                                  </object>
                                ) : (
                                  <div className="flex flex-col items-center text-slate-500">
                                    <FileText className="w-6 h-6 mb-1" />
                                    <span className="text-xs">Preview unavailable</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-600">
                                <span className="truncate pr-2">{f.name}</span>
                                <span className="font-semibold text-slate-500">{ext}</span>
                              </div>
                            </div>
                          );
                        })}
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
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (hasSubmitted ? 'Resubmit Request' : 'Submit Request')}
                </button>
              </div>
            </form>
         </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-200" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">Pending Requests</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{pendingCount}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
                <Clock className="w-6 h-6 text-orange-600 dark:text-orange-200" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">In Progress</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{inProgressCount}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-200" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-300 font-medium">Completed</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{completedCount}</p>
            </div>
        </div>
      </div>

      {/* Main Action and List */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/70">
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Request History</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">Track the status of your automation requests.</p>
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
              <div className="bg-slate-50 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">No requests yet</h3>
              <p className="text-slate-500 dark:text-slate-300 mb-6">Start by submitting your first automation idea.</p>
           </div>
        ) : (
            <div className="space-y-8">
              <div>
                <div className="flex items-center justify-between px-6 pt-6">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Awaiting / In progress</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{awaitingRequests.length} item{awaitingRequests.length === 1 ? '' : 's'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold uppercase text-xs">
                          <tr>
                              <th className="px-6 py-4">Title</th>
                              <th className="px-6 py-4">Project</th>
                              <th className="px-6 py-4">Created</th>
                              <th className="px-6 py-4">Priority</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {awaitingRequests.map(req => {
                              const submissionCount = req.submissionCount ?? (req as any).submissionEvents?.length ?? 0;
                              return (
                                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer" onClick={() => onViewRequest(req)}>
                                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{req.title}</td>
                                      <td className="px-6 py-4">{req.projectName}</td>
                                      <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                                      <td className="px-6 py-4">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${priorityClasses(req.priority)}`}>
                                              {req.priority}
                                          </span>
                                      </td>
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
                                          {submissionCount > 1 && (
                                            <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-300">
                                              ({submissionCount - 1} resubmit{submissionCount - 1 === 1 ? '' : 's'})
                                            </span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <button className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium text-xs">View Details</button>
                                      </td>
                                  </tr>
                              );
                          })}
                          {awaitingRequests.length === 0 && (
                            <tr>
                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>No active requests.</td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between px-6 pb-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Completed</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{doneRequests.length} item{doneRequests.length === 1 ? '' : 's'}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold uppercase text-xs">
                          <tr>
                              <th className="px-6 py-4">Title</th>
                              <th className="px-6 py-4">Project</th>
                              <th className="px-6 py-4">Created</th>
                              <th className="px-6 py-4">Priority</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {doneRequests.map(req => {
                              const submissionCount = req.submissionCount ?? (req as any).submissionEvents?.length ?? 0;
                              return (
                                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer" onClick={() => onViewRequest(req)}>
                                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{req.title}</td>
                                      <td className="px-6 py-4">{req.projectName}</td>
                                      <td className="px-6 py-4">{new Date(req.createdAt).toLocaleDateString()}</td>
                                      <td className="px-6 py-4">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${priorityClasses(req.priority)}`}>
                                              {req.priority}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                          Completed
                                      </span>
                                          {submissionCount > 1 && (
                                            <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-300">
                                              ({submissionCount - 1} resubmit{submissionCount - 1 === 1 ? '' : 's'})
                                            </span>
                                          )}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <button className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-200 font-medium text-xs">View Details</button>
                                      </td>
                                  </tr>
                              );
                          })}
                          {doneRequests.length === 0 && (
                            <tr>
                              <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>No completed requests yet.</td>
                            </tr>
                          )}
                      </tbody>
                  </table>
                </div>
              </div>
            </div>
        )}
      </div>
    </div>
  );
};
