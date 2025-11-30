
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, User, Calendar, AlertCircle, Bot, Code, Send, Check, Building, Layers, Clock, Loader2, Upload, FileCode, Trash2, Download, Copy, CheckCircle } from 'lucide-react';
import { AutomationRequest, RequestStatus, AIAnalysis, Attachment } from '../types';
import { saveRequest } from '../services/storageService';
import { analyzeRequestWithGemini } from '../services/geminiService';
import { sendEmailNotification } from '../services/notificationService';

interface Props {
  request: AutomationRequest;
  isDeveloper: boolean;
  onBack: () => void;
  onUpdate: () => void;
}

export const RequestDetail: React.FC<Props> = ({ request, isDeveloper, onBack, onUpdate }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [localReq, setLocalReq] = useState(request);
  const [pythonCode, setPythonCode] = useState(request.resultScript || '');
  const [fileName, setFileName] = useState<string | undefined>(request.resultFileName);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if request prop changes
  useEffect(() => {
    setLocalReq(request);
    setPythonCode(request.resultScript || '');
    setFileName(request.resultFileName);
  }, [request]);

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
      alert("Analysis failed. Ensure API KEY is set in environment.");
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCode = async () => {
    const updated = { 
        ...localReq, 
        resultScript: pythonCode, 
        resultFileName: fileName,
        status: RequestStatus.COMPLETED, 
        updatedAt: Date.now() 
    };
    await saveRequest(updated);
    setLocalReq(updated);
    onUpdate();
    
    // Send Email Notification via Backend
    await sendEmailNotification({
      subject: `Request Completed: ${localReq.title}`,
      body: `Good news! Your automation request "${localReq.title}" has been marked as COMPLETED by the development team.\n\nYou can now log in to the portal to view and download the result script.\n\nProject: ${localReq.projectName}\nCompleted: ${new Date().toLocaleDateString()}`
    });

    alert(`✅ Request marked as Completed.\n\n📧 Automated email notification sent to ${localReq.requesterName}.`);
  };

  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set filename state for UI
    setFileName(file.name);

    // Read content for backend storage
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPythonCode(content);
    };
    reader.readAsText(file);
    
    // Clear input so same file can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = () => {
      setFileName(undefined);
      setPythonCode('');
  };

  const handleDownloadScript = () => {
      const element = document.createElement("a");
      const file = new Blob([localReq.resultScript || ''], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = localReq.resultFileName || "script.py";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
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

  const handleCopyCode = () => {
      navigator.clipboard.writeText(localReq.resultScript || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <button 
        onClick={onBack}
        className="mb-6 flex items-center text-slate-500 hover:text-indigo-600 transition text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-6">
               <div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-slate-400">ID: {localReq.id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            localReq.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                            localReq.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {localReq.priority} Priority
                        </span>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 leading-tight">{localReq.title}</h1>
               </div>
               
              {isDeveloper ? (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                    <span className="text-xs font-semibold text-slate-500 px-2">Status:</span>
                    <select 
                    value={localReq.status}
                    onChange={(e) => handleStatusChange(e.target.value as RequestStatus)}
                    className="bg-white border-0 text-slate-900 text-sm rounded-md focus:ring-0 py-1.5 pl-3 pr-8 font-medium shadow-sm"
                    >
                    {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
              ) : (
                  <span className={`px-4 py-2 rounded-lg text-sm font-bold border ${
                    localReq.status === RequestStatus.COMPLETED ? 'bg-green-50 text-green-700 border-green-200' :
                    localReq.status === RequestStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                      {localReq.status}
                  </span>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-8 border border-slate-100">
                <div>
                    <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Project</span>
                    <div className="flex items-center font-medium text-slate-900"><Building className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.projectName}</div>
                </div>
                <div>
                    <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Revit Version</span>
                    <div className="flex items-center font-medium text-slate-900"><Layers className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.revitVersion}</div>
                </div>
                <div>
                    <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Requester</span>
                    <div className="flex items-center font-medium text-slate-900"><User className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> {localReq.requesterName}</div>
                </div>
                 <div>
                    <span className="block text-xs text-slate-500 uppercase font-semibold mb-1">Due Date</span>
                    <div className="flex items-center font-medium text-slate-900">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400"/> 
                        {localReq.dueDate ? new Date(localReq.dueDate).toLocaleDateString() : 'None'}
                    </div>
                </div>
            </div>

            <div className="prose prose-slate max-w-none">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">Description</h3>
                <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mb-8">{localReq.description}</p>
            </div>

            {localReq.attachments.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Attachments</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {localReq.attachments.map((att, idx) => (
                    <div key={idx} className="relative group flex-shrink-0">
                        {att.type.startsWith('image/') ? (
                            <img src={att.data} alt={att.name} className="h-40 w-auto rounded-lg border border-slate-200 object-cover shadow-sm group-hover:shadow-md transition" />
                        ) : (
                          <div className="h-40 w-32 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-4 text-center hover:bg-slate-100 transition">
                            <Code className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-xs text-slate-600 break-all">{att.name}</span>
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
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                      <Code className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-slate-900">Automation Script</h3>
                      <p className="text-sm text-slate-500">Python code for Revit API</p>
                  </div>
                </div>
                {isDeveloper && (
                  <div>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleScriptUpload}
                      accept=".py,.txt"
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition"
                    >
                      <Upload className="w-4 h-4" /> Upload .py File
                    </button>
                  </div>
                )}
            </div>
            
            {isDeveloper ? (
                <div className="space-y-4">
                    {/* File Card or Editor */}
                    {fileName ? (
                         <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-2 rounded-md border border-slate-200 shadow-sm">
                                    <FileCode className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900 text-sm">{fileName}</p>
                                    <p className="text-xs text-slate-500">Ready to publish</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleRemoveFile}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                title="Remove file"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                    ) : (
                        <textarea 
                            value={pythonCode}
                            onChange={(e) => setPythonCode(e.target.value)}
                            className="w-full h-[500px] bg-[#0d1117] text-slate-300 font-mono text-sm p-4 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                            placeholder="# Paste your pyRevit/RevitPythonShell code here...&#10;import clr&#10;clr.AddReference('RevitAPI')&#10;from Autodesk.Revit.DB import *"
                            spellCheck={false}
                        />
                    )}
                    
                    <div className="flex justify-end gap-3">
                         <button 
                            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                        >
                            Save Draft
                        </button>
                        <button 
                            onClick={handleSaveCode}
                            disabled={!pythonCode}
                            className={`px-6 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium shadow-sm ${!pythonCode ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                        >
                            <Send className="w-4 h-4" /> Publish & Complete
                        </button>
                    </div>
                </div>
            ) : (
                /* Requester View */
                localReq.resultScript ? (
                    localReq.resultFileName ? (
                        /* File View for Requester */
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 flex items-center justify-between group hover:border-indigo-300 transition">
                            <div className="flex items-center gap-4">
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                    <FileCode className="w-8 h-8 text-indigo-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">{localReq.resultFileName}</h4>
                                    <p className="text-sm text-slate-500">Python Script</p>
                                </div>
                            </div>
                            <button 
                                onClick={handleDownloadScript}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"
                            >
                                <Download className="w-4 h-4" /> Download
                            </button>
                        </div>
                    ) : (
                        /* Text/Inline Code View for Requester */
                        <div className="relative group rounded-lg overflow-hidden border border-slate-800 shadow-md">
                            <div className="h-10 bg-[#0d1117] flex items-center justify-between px-4 border-b border-slate-700">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-500"/>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500"/>
                                    <div className="w-3 h-3 rounded-full bg-green-500"/>
                                </div>
                                <button 
                                    onClick={handleCopyCode}
                                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded"
                                >
                                    {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copied!' : 'Copy Code'}
                                </button>
                            </div>
                            <pre className="w-full bg-[#0d1117] text-slate-300 font-mono text-sm p-6 overflow-x-auto">
                                <code>{localReq.resultScript}</code>
                            </pre>
                        </div>
                    )
                ) : (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-16 text-center">
                        <Code className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-slate-900 font-medium">No Code Available Yet</h4>
                        <p className="text-slate-500 text-sm mt-1">The developer is still working on this request.</p>
                    </div>
                )
            )}
          </div>
        </div>

        {/* Sidebar (AI & Meta) */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4 text-sm uppercase tracking-wide">Timeline</h4>
                <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 py-2">
                    <div className="ml-6 relative">
                        <div className="absolute -left-[31px] bg-white border-2 border-green-500 rounded-full w-4 h-4"></div>
                        <p className="text-sm font-semibold text-slate-900">Request Submitted</p>
                        <p className="text-xs text-slate-500 mt-0.5">{new Date(localReq.createdAt).toLocaleString()}</p>
                    </div>
                    {localReq.updatedAt !== localReq.createdAt && (
                         <div className="ml-6 relative">
                            <div className="absolute -left-[31px] bg-white border-2 border-blue-500 rounded-full w-4 h-4"></div>
                            <p className="text-sm font-semibold text-slate-900">Last Updated</p>
                            <p className="text-xs text-slate-500 mt-0.5">{new Date(localReq.updatedAt).toLocaleString()}</p>
                        </div>
                    )}
                     {localReq.status === RequestStatus.COMPLETED && (
                         <div className="ml-6 relative">
                            <div className="absolute -left-[31px] bg-green-600 rounded-full w-4 h-4 flex items-center justify-center">
                                <Check className="w-2 h-2 text-white" />
                            </div>
                            <p className="text-sm font-semibold text-slate-900">Completed</p>
                            <p className="text-xs text-slate-500 mt-0.5">{new Date(localReq.updatedAt).toLocaleDateString()}</p>
                        </div>
                    )}
                </div>
            </div>

            {isDeveloper && (
                <div className="bg-gradient-to-b from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -translate-y-16 translate-x-16 opacity-50"></div>
                    
                    <div className="flex items-center gap-2 mb-6 relative z-10">
                        <div className="bg-white p-1.5 rounded-lg border border-indigo-100 shadow-sm">
                             <Bot className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-slate-900">Gemini Assistant</h3>
                    </div>
                    
                    {!localReq.aiAnalysis ? (
                        <div className="text-center py-4 relative z-10">
                            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
                                Use AI to estimate complexity, suggest API namespaces, and generate a strategy for <span className="font-mono text-indigo-600">Revit {localReq.revitVersion}</span>.
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
                        <div className="space-y-5 text-sm relative z-10">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-500 text-xs font-semibold uppercase">Complexity Score</span>
                                    <span className="font-bold text-indigo-600">{localReq.aiAnalysis.complexityScore}/10</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                     <div 
                                        className="h-full bg-indigo-500 rounded-full" 
                                        style={{width: `${localReq.aiAnalysis.complexityScore * 10}%`}}
                                     />
                                </div>
                            </div>

                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase block mb-2">Namespaces</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {localReq.aiAnalysis.suggestedNamespaces.map((ns, i) => (
                                        <span key={i} className="bg-white border border-indigo-100 text-slate-600 px-2 py-1 rounded text-[10px] font-mono shadow-sm">{ns}</span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white p-3 rounded-lg border border-indigo-50 shadow-sm">
                                <span className="text-slate-500 text-xs font-semibold uppercase block mb-1">Strategy</span>
                                <p className="text-slate-700 text-xs leading-relaxed">{localReq.aiAnalysis.implementationStrategy}</p>
                            </div>

                            <div>
                                <span className="text-slate-500 text-xs font-semibold uppercase block mb-2">Pseudo-Code</span>
                                <pre className="bg-[#1e1e1e] text-slate-300 p-3 rounded-lg text-[10px] overflow-x-auto border border-slate-700">
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
    </div>
  );
};
