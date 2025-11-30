import React, { useState, useRef } from 'react';
import { ArrowLeft, User, Calendar, AlertCircle, Bot, Code, Send, Check, Building, Layers, Clock, Loader2, Upload } from 'lucide-react';
import { AutomationRequest, RequestStatus, AIAnalysis } from '../types';
import { saveRequest } from '../services/storageService';
import { analyzeRequestWithGemini } from '../services/geminiService';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const updated = { ...localReq, resultScript: pythonCode, status: RequestStatus.COMPLETED, updatedAt: Date.now() };
    await saveRequest(updated);
    setLocalReq(updated);
    onUpdate();
    alert("Solution saved and request marked as Completed.");
  };

  const handleScriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPythonCode(content);
    };
    reader.readAsText(file);
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
                    att.type.startsWith('image/') ? (
                      <div key={idx} className="relative group">
                          <img src={att.data} alt={att.name} className="h-40 w-auto rounded-lg border border-slate-200 object-cover shadow-sm group-hover:shadow-md transition" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-lg flex items-center justify-center text-white text-xs">
                              {att.name}
                          </div>
                      </div>
                    ) : (
                      <div key={idx} className="h-40 w-32 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-4 text-center hover:bg-slate-100 transition">
                        <Code className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-xs text-slate-600 break-all">{att.name}</span>
                      </div>
                    )
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
                    <textarea 
                        value={pythonCode}
                        onChange={(e) => setPythonCode(e.target.value)}
                        className="w-full h-[500px] bg-[#0d1117] text-slate-300 font-mono text-sm p-4 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                        placeholder="# Paste your pyRevit/RevitPythonShell code here...&#10;import clr&#10;clr.AddReference('RevitAPI')&#10;from Autodesk.Revit.DB import *"
                        spellCheck={false}
                    />
                    <div className="flex justify-end gap-3">
                         <button 
                            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
                        >
                            Save Draft
                        </button>
                        <button 
                            onClick={handleSaveCode}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition text-sm font-medium shadow-sm"
                        >
                            <Send className="w-4 h-4" /> Publish & Complete
                        </button>
                    </div>
                </div>
            ) : (
                localReq.resultScript ? (
                    <div className="relative group">
                        <div className="absolute top-0 left-0 right-0 h-8 bg-[#0d1117] rounded-t-lg flex items-center px-4 border-b border-slate-700">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500"/>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"/>
                                <div className="w-3 h-3 rounded-full bg-green-500"/>
                            </div>
                        </div>
                        <pre className="w-full bg-[#0d1117] text-slate-300 font-mono text-sm p-6 pt-12 rounded-lg overflow-x-auto shadow-inner">
                            <code>{localReq.resultScript}</code>
                        </pre>
                        <button 
                            onClick={() => navigator.clipboard.writeText(localReq.resultScript || '')}
                            className="absolute top-12 right-4 bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 transition shadow-lg"
                        >
                            Copy Code
                        </button>
                    </div>
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