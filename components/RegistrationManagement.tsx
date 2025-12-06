import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, XCircle, Loader2, UserPlus } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { EMPLOYEE_ROLE, DEVELOPER_ROLE, UserRole } from '../types';

interface RegistrationRequest {
  id: number;
  name: string;
  email: string;
  companyRole?: string;
  status: string;
  createdAt: number;
  reviewedBy?: number;
  reviewedAt?: number;
  companyRole?: string;
}

export const RegistrationManagement: React.FC = () => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
<<<<<<< HEAD
  const [roleInputs, setRoleInputs] = useState<Record<number, UserRole>>({});
  const [companyRoleInputs, setCompanyRoleInputs] = useState<Record<number, string>>({});
=======
>>>>>>> 36dcac0a147038d0e62315b0971eabc670d8ab4e

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const data = await apiClient.get('/registration-requests');
      setRequests(data);
      const nextRoles: Record<number, UserRole> = {};
      const nextCompanyRoles: Record<number, string> = {};
      (data || []).forEach((req: RegistrationRequest) => {
        nextRoles[req.id] = roleInputs[req.id] || EMPLOYEE_ROLE;
        if (req.companyRole) nextCompanyRoles[req.id] = req.companyRole;
      });
      setRoleInputs(nextRoles);
      setCompanyRoleInputs(prev => ({ ...nextCompanyRoles, ...prev }));
    } catch (err) {
      console.error('Failed to load registration requests:', err);
    } finally {
      setLoading(false);
    }
  };

<<<<<<< HEAD
  const handleApprove = async (id: number) => {
    const role = roleInputs[id] || EMPLOYEE_ROLE;
    const companyRole = (companyRoleInputs[id] || '').trim();
    setProcessing(id);
    try {
      await apiClient.post(`/registration-requests/${id}/approve`, { role, companyRole: companyRole || undefined });
=======
  const handleApprove = async (id: number, companyRole?: string) => {
    setProcessing(id);
    try {
      await apiClient.post(`/registration-requests/${id}/approve`, companyRole ? { companyRole } : {});
>>>>>>> 36dcac0a147038d0e62315b0971eabc670d8ab4e
      await loadRequests();
      alert('Registration approved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to approve registration');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!window.confirm('Are you sure you want to reject this registration request?')) {
      return;
    }
    
    setProcessing(id);
    try {
      await apiClient.post(`/registration-requests/${id}/reject`, {});
      await loadRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to reject registration');
    } finally {
      setProcessing(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const processedRequests = requests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Registration Requests</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Review and approve new user registrations</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-indigo-600 dark:text-indigo-400 text-lg">{pendingRequests.length}</span>
              <span className="text-sm text-indigo-600 dark:text-indigo-400">Pending</span>
            </div>
          </div>
        </div>

        {pendingRequests.length === 0 && (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
            <CheckCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">No pending requests</h3>
            <p className="text-slate-500 dark:text-slate-400">All registration requests have been reviewed</p>
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div 
                key={req.id}
                className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 p-5 rounded-lg border-2 border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                        {req.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{req.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Mail className="w-3.5 h-3.5" />
                          {req.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500 mt-2">
                      <Clock className="w-3.5 h-3.5" />
                      Requested {new Date(req.createdAt).toLocaleString()}
                    </div>
                    </div>
                    
                  <div className="flex gap-3 items-center">
<<<<<<< HEAD
                    <div className="flex flex-col gap-2">
                      <select
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        value={roleInputs[req.id] || EMPLOYEE_ROLE}
                        onChange={(e) => setRoleInputs(prev => ({ ...prev, [req.id]: e.target.value as UserRole }))}
                      >
                        <option value={EMPLOYEE_ROLE}>Employee</option>
                        <option value={DEVELOPER_ROLE}>Developer</option>
                      </select>
                      <input
                        type="text"
                        className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                        placeholder="Company role (e.g. Architect)"
                        value={companyRoleInputs[req.id] || ''}
                        onChange={(e) => setCompanyRoleInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                      />
=======
                    <div className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
                      {req.companyRole || 'Role not provided'}
>>>>>>> 36dcac0a147038d0e62315b0971eabc670d8ab4e
                    </div>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processing === req.id}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2 font-medium"
                    >
                      {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(req.id, req.companyRole)}
                      disabled={processing === req.id}
                      className="px-4 py-2 bg-green-600 dark:bg-green-700 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition flex items-center gap-2 font-medium shadow-sm"
                    >
                      {processing === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {processedRequests.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-white">Processed Requests</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Company Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {processedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{req.name}</td>
                    <td className="px-6 py-4">{req.email}</td>
                    <td className="px-6 py-4">{req.companyRole || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        req.status === 'APPROVED' 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
                          : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      }`}>
                        {req.status === 'APPROVED' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
