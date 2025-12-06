
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, Bot, Code, Send, Building, Layers, Clock, Loader2, Upload, FileCode, Download } from 'lucide-react';
import { AutomationRequest, RequestStatus, AIAnalysis, Attachment, Comment } from '../types';
import { saveRequest, fileToBase64 } from '../services/storageService';
import { analyzeRequestWithGemini } from '../services/geminiService';
import { sendEmailNotification } from '../services/notificationService';
import { apiClient } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';

interface Props {
  request: AutomationRequest;
  isDeveloper: boolean;
  onBack: () => void;
  onUpdate: () => void;
}

export const RequestDetail: React.FC<Props> = ({ request, isDeveloper, onBack, onUpdate }) => {
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);
  const [localReq, setLocalReq] = useState(request);
  const [resultFiles, setResultFiles] = useState<Attachment[]>(request.resultFiles || []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSavingResults, setIsSavingResults] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [comments, setComments] = useState<Comment[]>(request.comments || []);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [banner, setBanner] = useState<{ text: string; tone: 'info' | 'error' | 'success' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const submissionEvents = [...(localReq.submissionEvents || [])].sort((a, b) => a.createdAt - b.createdAt);
  const submissionCount = Math.max(localReq.submissionCount ?? 0, submissionEvents.length);
  const normalizedEvents = submissionEvents.length === 0 && submissionCount > 0
    ? (() => {
        const tsBase = localReq.updatedAt || localReq.createdAt || Date.now();
        const synthetic = [{
          id: -1,
          requestId: Number(localReq.id),
          eventType: 'SUBMISSION',
          createdAt: tsBase,
          addedFiles: resultFiles.length,
        }];
        if (submissionCount > 1) {
          for (let i = 1; i < submissionCount; i++) {
            synthetic.push({
              id: -1 - i,
              requestId: Number(localReq.id),
              eventType: 'RESUBMISSION',
              createdAt: tsBase + i,
              addedFiles: 0,
            });
          }
        }
        return synthetic;
      })()
    : submissionEvents;
  const stackedFiles = [
    ...(resultFiles || []).map((att) => ({
      key: `saved-${(att as any).id ?? att.name}`,
      name: att.name,
      type: att.type,
      status: 'saved' as const,
      attachment: att,
    })),
    ...pendingFiles.map((file, idx) => ({
      key: `pending-${idx}-${file.name}`,
      name: file.name,
      type: file.type || 'File',
      status: 'pending' as const,
      index: idx,
    })),
  ];
  const hasSubmission = submissionCount > 0;

  // Sync state if request prop changes
  useEffect(() => {
    setLocalReq(request);
    setResultFiles(request.resultFiles || []);
    setPendingFiles([]);
    setComments(request.comments || []);
  }, [request]);

  useEffect(() => {
    if (isDeveloper) {
      refreshRequest().catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStatusChange = async (status: RequestStatus) => {
    const updated = { ...localReq, status, updatedAt: Date.now() };
    await saveRequest(updated);
    setLocalReq(updated);
    onUpdate();
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const analysis = await analyzeRequestWithGemini(localReq);
      const updated = { ...localReq, aiAnalysis: analysis };
      await saveRequest(updated);
      setLocalReq(updated);
      onUpdate();
    } catch (e) {
      console.error(e);
      setBanner({ text: 'Analysis failed. Ensure API key is set.', tone: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  const refreshRequest = async () => {
    const fresh = await apiClient.get(`/requests/${localReq.id}`);
    setLocalReq(fresh);
    setResultFiles(fresh.resultFiles || []);
    setComments(fresh.comments || []);
    return fresh;
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const data = await apiClient.get(`/requests/${localReq.id}/comments`);
      setComments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadComments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localReq.id]);

  const handleAddFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming || []);
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingFile = async (file: Attachment) => {
    const resolvedId = file.id ?? localReq.resultFiles?.find((att) => att.name === file.name)?.id;
    if (!resolvedId) {
      setResultFiles((prev) => prev.filter((att) => att.name !== file.name));
      setBanner({ text: 'Removed from stack.', tone: 'info' });
      return;
    }
    setIsSavingResults(true);
    try {
      await apiClient.delete(`/requests/${Number(localReq.id)}/result-files/${Number(resolvedId)}?name=${encodeURIComponent(file.name)}`);
      await refreshRequest();
      onUpdate();
    } catch (err: any) {
      setBanner({ text: err.message || 'Failed to delete file', tone: 'error' });
    } finally {
      setIsSavingResults(false);
    }
  };

  const handleSubmitFiles = async () => {
    if (!localReq.id) return;
    if (pendingFiles.length === 0) {
      setBanner({ text: 'Add at least one file to submit or resubmit.', tone: 'error' });
      return;
    }
    setIsSavingResults(true);
    try {
      const payload = await Promise.all(
        pendingFiles.map(async (file) => ({
          name: file.name,
          type: file.type || 'application/octet-stream',
          data: await fileToBase64(file),
        }))
      );
      await apiClient.post(`/requests/${localReq.id}/result-files`, payload);
      await saveRequest({ ...localReq, status: RequestStatus.COMPLETED });
      const fresh = await refreshRequest();
      setPendingFiles([]);
      onUpdate();
      
      await sendEmailNotification({
        subject: `Request Completed: ${fresh.title}`,
        body: `Good news! Your automation request "${fresh.title}" has been updated by the development team.\n\nProject: ${fresh.projectName}\nStatus: ${fresh.status}\nUpdated: ${new Date().toLocaleDateString()}`,
      });

      setBanner({ text: 'Files submitted successfully.', tone: 'success' });
    } catch (err: any) {
      console.error(err);
      setBanner({ text: err.message || 'Failed to submit files', tone: 'error' });
    } finally {
      setIsSavingResults(false);
    }
  };

  const handleReturnToDeveloper = async () => {
    const updated = {
      ...localReq,
      status: RequestStatus.RETURNED,
      updatedAt: Date.now(),
    };
    await saveRequest(updated);
    setLocalReq(updated);
    onUpdate();
    await loadComments();
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await apiClient.post(`/requests/${localReq.id}/comments`, { content: newComment.trim() });
      setNewComment('');
      await loadComments();
    } catch (err: any) {
      setBanner({ text: err.message || 'Failed to add comment', tone: 'error' });
    }
  };

  const handleDownloadAttachment = (att: Attachment) => {
      // Decode Base64 to binary
      const byteString = atob(att.data.split(',')[1]);
      const mimeString = att.data.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], {type: mimeString});

      // Create download link
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = att.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  const formatDateTime = (ts?: number) => ts ? new Date(ts).toLocaleString() : '---';
  const timelineItems = (() => {
    const items: { title: string; timestamp: number; color: string; detail?: string; order: number }[] = [];
    items.push({
      title: 'Request Submitted',
      timestamp: localReq.createdAt,
      color: 'border-green-500',
      detail: `Filed by ${localReq.requesterName}`,
      order: 0,
    });
    let resubNumber = 0;
    normalizedEvents.forEach((ev, idx) => {
      const isResub = ev.eventType === 'RESUBMISSION';
      if (isResub) resubNumber += 1;
      items.push({
        title: isResub ? `Resubmission #${resubNumber}` : 'Files Submitted',
        timestamp: ev.createdAt,
        color: isResub ? 'border-orange-500' : 'border-blue-500',
        detail: `${ev.addedFiles} file${ev.addedFiles === 1 ? '' : 's'} stacked`,
        order: idx + 1,
      });
    });
    const statusTs = localReq.updatedAt || localReq.createdAt;
    let statusTitle = '';
    let statusColor = 'border-slate-400';
    let statusDetail = 'Status updated';
    if (localReq.status === RequestStatus.COMPLETED) {
      statusTitle = 'Completed';
      statusColor = 'border-emerald-500';
      statusDetail = 'Marked as completed';
    } else if (localReq.status === RequestStatus.RETURNED) {
      statusTitle = 'Returned to Developer';
      statusColor = 'border-red-500';
      statusDetail = 'Requester returned the delivery';
    } else if (localReq.status === RequestStatus.IN_PROGRESS) {
      statusTitle = 'In Progress';
      statusColor = 'border-blue-400';
    } else if (localReq.status === RequestStatus.PENDING) {
      statusTitle = 'Pending';
      statusColor = 'border-yellow-400';
    } else if (localReq.status === RequestStatus.REJECTED) {
      statusTitle = 'Rejected';
      statusColor = 'border-red-500';
    }
    if (statusTitle) {
      items.push({
        title: statusTitle,
        timestamp: statusTs,
        color: statusColor,
        detail: statusDetail,
        order: 999,
      });
    }
    return items.sort((a, b) => {
      if (a.timestamp === b.timestamp) return a.order - b.order;
      return a.timestamp - b.timestamp;
    });
  })();

  return (
    <div className="max-w-6xl mx-auto pb-12 text-slate-900 dark:text-slate-100">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center text-slate-500 dark:text-slate-300 hover:text-indigo-400 transition text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex justify-between items-start mb-6">
               <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">ID: {localReq.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            localReq.priority === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                                            localReq.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
                                        }`}>
                                            {localReq.priority} Priority
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight">{localReq.title}</h1>
               </div>
               
              {isDeveloper ? (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-300 px-2">Status:</span>
                    <select 
                    value={localReq.status}
                    onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}
                    className="bg-white dark:bg-slate-900 border-0 text-slate-900 dark:text-slate-100 text-sm rounded-md focus:ring-0 py-1.5 pl-3 pr-8 font-medium shadow-sm"
                    >
                    {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
              ) : (
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-lg text-sm font-bold border ${
                      localReq.status === RequestStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                      localReq.status === RequestStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800' :
                      localReq.status === RequestStatus.RETURNED ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800' :
                      'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                    }`}>
                        {localReq.status}
                    </span>
                    {localReq.status === RequestStatus.COMPLETED && (
                      <button
                        onClick={handleReturnToDeveloper}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white shadow-sm"
                      >
                        Return to Developer
                      </button>
                    )}
                  </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-8 border border-slate-100 dark:border-slate-700">
                <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-300 uppercase font-semibold mb-1">Project</span>
                    <div className="flex items-center font-medium text-slate-900 dark:text-slate-100"><Building className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.projectName}</div>
                </div>
                <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-300 uppercase font-semibold mb-1">Revit Version</span>
                    <div className="flex items-center font-medium text-slate-900 dark:text-slate-100"><Layers className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.revitVersion}</div>
                </div>
                <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-300 uppercase font-semibold mb-1">Requester</span>
                    <div className="flex items-center font-medium text-slate-900 dark:text-slate-100"><User className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.requesterName}</div>
                </div>
                 <div>
                    <span className="block text-xs text-slate-500 dark:text-slate-300 uppercase font-semibold mb-1">Due Date</span>
                    <div className="flex items-center font-medium text-slate-900 dark:text-slate-100">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> 
                        {localReq.dueDate ? new Date(localReq.dueDate).toLocaleDateString() : 'None'}
                    </div>
                </div>
            </div>

            <div className="prose prose-slate dark:prose-invert max-w-none">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Description</h3>
                <p className="text-slate-600 dark:text-slate-200 whitespace-pre-wrap leading-relaxed mb-8">{localReq.description}</p>
            </div>

            {localReq.attachments?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide mb-3">Attachments</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {localReq.attachments.map((att, idx) => (
                    <div key={idx} className="relative group flex-shrink-0">
                        {att.type.startsWith('image/') ? (
                            <img src={att.data} alt={att.name} className="h-40 w-auto rounded-lg border border-slate-200 dark:border-slate-700 object-cover shadow-sm group-hover:shadow-md transition" />
                        ) : att.type.includes('pdf') ? (
                          <object data={att.data} type={att.type} className="h-40 w-32 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-xs px-2 text-center">
                              PDF preview unavailable
                            </div>
                          </object>
                        ) : (
                          <div className="h-40 w-32 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-4 text-center hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                            <Code className="w-8 h-8 text-slate-400 dark:text-slate-300 mb-2" />
                            <span className="text-xs text-slate-600 dark:text-slate-200 break-all">{att.name}</span>
                          </div>
                        )}
                        
                        {/* Download Overlay for Developer */}
                        {isDeveloper && (
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(att); }}
                                    className="bg-white text-slate-800 p-2 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition"
                                    title="Download File"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                         
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate rounded-b-lg text-center opacity-0 group-hover:opacity-100 transition">
                            {att.name}
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Solution Section */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {banner && (
              <div className={`mb-4 px-4 py-2 rounded-lg text-sm border ${
                banner.tone === 'success' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800' :
                banner.tone === 'error' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800' :
                'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
              }`}>
                {banner.text}
              </div>
            )}
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2 rounded-lg">
                      <Code className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white">Automation Files</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Upload result files; employees can download them.</p>
                  </div>
                </div>
            </div>
            
              {isDeveloper ? (
                <div className="space-y-4">
                  <div
                    className={`border-2 border-dashed rounded-lg p-5 transition cursor-pointer ${dropActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDropActive(true); }}
                    onDragLeave={() => setDropActive(false)}
                    onDrop={handleDrop}
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm">
                        <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Drag, drop, or click to stack files</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Add multiple documents at once; after the first submission every upload is tracked as a resubmission.</p>
                        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-300">
                          <span>{resultFiles.length} in stack</span>
                          <span>{pendingFiles.length} pending</span>
                          {submissionCount > 1 && <span className="text-orange-500 font-semibold">Resubmissions: {submissionCount - 1}</span>}
                        </div>
                      </div>
                    </div>
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button
                      onClick={handleSubmitFiles}
                      className={`px-6 py-2 rounded-lg flex items-center gap-2 transition font-medium shadow-sm ${isSavingResults ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      disabled={isSavingResults}
                  >
                    {isSavingResults ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {hasSubmission ? 'Resubmit Files' : 'Submit Files'}
                  </button>
                    <span className="text-slate-600 dark:text-slate-300">{stackedFiles.length} file(s) in stack</span>
                    {pendingFiles.length > 0 && <span className="text-indigo-600 dark:text-indigo-300">{pendingFiles.length} ready to upload</span>}
                  </div>

                  {stackedFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stackedFiles.map((item) => (
                        <div key={item.key} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileCode className={`w-5 h-5 ${item.status === 'pending' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{item.type}</p>
                              <p className={`text-[11px] ${item.status === 'pending' ? 'text-indigo-500' : 'text-slate-500'}`}>
                                {item.status === 'pending' ? 'Pending resubmission' : 'In stack'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.status === 'saved' && (
                              <>
                                <button
                                  onClick={() => handleDownloadAttachment(item.attachment as Attachment)}
                                  className="text-indigo-600 dark:text-indigo-300 hover:underline text-xs"
                                >
                                  Download
                                </button>
                                <button
                                  onClick={() => handleRemoveExistingFile(item.attachment as Attachment)}
                                  className="text-red-500 hover:text-red-600 text-xs"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {item.status === 'pending' && (
                              <button
                                onClick={() => handleRemovePendingFile(item.index as number)}
                                className="text-red-500 hover:text-red-600 text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-sm text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50">
                      No result files stacked yet. Add files to submit the solution.
                    </div>
                  )}
                </div>
              ) : (
                /* Requester View */
                resultFiles.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {resultFiles.map((att, idx) => (
                      <div key={att.id ?? idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode className="w-5 h-5 text-indigo-500" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{att.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-300 truncate">{att.type}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadAttachment(att)}
                          className="text-indigo-600 dark:text-indigo-300 hover:underline text-xs"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 border-dashed rounded-lg p-16 text-center">
                      <Code className="w-12 h-12 text-slate-300 dark:text-slate-200 mx-auto mb-4" />
                      <h4 className="text-slate-900 dark:text-white font-medium">No Files Available Yet</h4>
                      <p className="text-slate-500 dark:text-slate-300 text-sm mt-1">The developer is still working on this request.</p>
                  </div>
                )
            )}
          </div>
        </div>

        {/* Sidebar (AI & Meta) */}
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Timeline</h4>
                <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-8 py-2">
                    {timelineItems.map((item, idx) => (
                      <div key={`${item.title}-${item.timestamp}-${idx}`} className="ml-6 relative">
                          <div className={`absolute -left-[31px] bg-white dark:bg-slate-900 rounded-full w-4 h-4 border-2 ${item.color}`}></div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">{formatDateTime(item.timestamp)}</p>
                          {item.detail && <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">{item.detail}</p>}
                      </div>
                    ))}
                    {timelineItems.length === 0 && (
                      <div className="ml-6 text-xs text-slate-500 dark:text-slate-400">No activity yet.</div>
                    )}
                </div>
            </div>

            {isDeveloper && (
                <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 p-6 rounded-xl border border-indigo-900/60 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl -translate-y-16 translate-x-16 opacity-60"></div>
                    
                    <div className="flex items-center gap-2 mb-6 relative z-10">
                        <div className="bg-white/10 p-1.5 rounded-lg border border-indigo-800 shadow-sm">
                             <Bot className="w-5 h-5 text-indigo-200" />
                        </div>
                        <h3 className="font-bold text-white">Gemini Assistant</h3>
                    </div>
                    
                    {!localReq.aiAnalysis ? (
                        <div className="text-center py-4 relative z-10">
                            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                                Use AI to estimate complexity, suggest API namespaces, and generate a strategy for <span className="font-mono text-indigo-200">Revit {localReq.revitVersion}</span>.
                            </p>
                            <button 
                                onClick={handleAnalyze}
                                disabled={analyzing}
                                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg transition font-medium flex justify-center items-center gap-2 text-sm shadow-md hover:bg-indigo-700"
                            >
                                {analyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <><Bot className="w-4 h-4" /> Analyze Request</>}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5 text-sm relative z-10 text-slate-200">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-400 text-xs font-semibold uppercase">Complexity Score</span>
                                    <span className="font-bold text-indigo-200">{localReq.aiAnalysis.complexityScore}/10</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full bg-indigo-500 rounded-full" 
                                        style={{width: `${localReq.aiAnalysis.complexityScore * 10}%`}}
                                     />
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-2">Namespaces</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {localReq.aiAnalysis.suggestedNamespaces.map((ns, i) => (
                                        <span key={i} className="bg-white/10 border border-indigo-800 text-indigo-100 px-2 py-1 rounded text-[10px] font-mono shadow-sm">{ns}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white/5 p-3 rounded-lg border border-indigo-800 shadow-sm">
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-1">Strategy</span>
                                <p className="text-slate-200 text-xs leading-relaxed">{localReq.aiAnalysis.implementationStrategy}</p>
                            </div>

                            <div>
                                <span className="text-slate-400 text-xs font-semibold uppercase block mb-2">Pseudo-Code</span>
                                <pre className="bg-[#1e1e1e] text-slate-200 p-3 rounded-lg text-[10px] overflow-x-auto border border-slate-700">
                                    {localReq.aiAnalysis.pseudoCode}
                                </pre>
                            </div>
                            
                            <button 
                                onClick={handleAnalyze} 
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium w-full text-center mt-2"
                            >
                                Re-run Analysis
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Comments */}
      <div className="mt-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Comments</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Discuss issues or feedback with the developer.</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        </div>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {loadingComments ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-300">No comments yet.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/70">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300 mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">{c.authorName}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{c.content}</p>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex items-start gap-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={2}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${!newComment.trim() ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
};
