import React, { useState, useEffect } from 'react';
import { Mail, Shield, Trash2, UserPlus, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { User, UserRole, DEVELOPER_ROLE, EMPLOYEE_ROLE } from '../types';
import { getAllUsers, createUser, deleteUser, updateUserRole, removeDemoAccounts } from '../services/authService';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [isCleaningDemo, setIsCleaningDemo] = useState(false);
  
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    companyRole: '',
    systemRole: EMPLOYEE_ROLE as UserRole
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await getAllUsers();
    setUsers(data);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (newUser.password.length < 4) {
          alert("Password must be at least 4 characters.");
          return;
      }
      await createUser(newUser.name, newUser.email, newUser.password, newUser.companyRole, newUser.systemRole);
      setNewUser({ name: '', email: '', password: '', companyRole: '', systemRole: EMPLOYEE_ROLE });
      setIsAddingUser(false);
      await loadUsers();
      setBanner('User added successfully');
    } catch (err: any) {
      setBanner(err.message || 'Failed to add user');
    }
  };

  const handleChangeRole = async (targetUser: User, targetRole: UserRole) => {
    setLoadingUserId(targetUser.id.toString());
    setBanner(null);
    try {
      await updateUserRole(targetUser.id.toString(), targetRole);
      await loadUsers();
      setBanner(targetRole === DEVELOPER_ROLE ? 'User promoted to developer privileges' : 'Developer privileges removed');
    } catch (err: any) {
      setBanner(err.message || 'Failed to update role');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this user?');
    if (!confirmed) return;
    setLoadingUserId(id.toString());
    setBanner(null);
    try {
      await deleteUser(id);
      await loadUsers();
      setIsAddingUser(false);
      setBanner('User removed and list refreshed');
    } catch (err: any) {
      setBanner(err.message || 'Failed to delete user');
    } finally {
      setLoadingUserId(null);
    }
  };

  const handleRemoveDemoAccounts = async () => {
    const demoExists = users.some(u => u.isDemo);
    if (!demoExists) {
      setBanner('No demo accounts found to remove.');
      return;
    }
    const confirmed = window.confirm('Remove the pre-seeded demo accounts? Make sure at least one real developer account exists first.');
    if (!confirmed) return;
    setIsCleaningDemo(true);
    setBanner(null);
    try {
      await removeDemoAccounts();
      await loadUsers();
      setBanner('Demo accounts removed. Sign in with a real developer account to continue working.');
    } catch (err: any) {
      setBanner(err.message || 'Failed to remove demo accounts');
    } finally {
      setIsCleaningDemo(false);
    }
  };

  const demoUsers = users.filter(u => u.isDemo);
  const hasDemoUsers = demoUsers.length > 0;

  return (
      <div className="space-y-6 text-slate-900 dark:text-slate-100">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
            <p className="text-slate-500 dark:text-slate-300 mt-1">Create and manage accounts for architects and developers.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleRemoveDemoAccounts}
              disabled={isCleaningDemo}
              className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-4 py-2 rounded-lg text-sm font-semibold border border-amber-200 dark:border-amber-800 hover:bg-amber-200/70 dark:hover:bg-amber-800/60 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Remove the seeded demo developer and employee accounts"
            >
              <AlertTriangle className="w-4 h-4" />
              {isCleaningDemo ? 'Removing...' : 'Remove Demo Accounts'}
            </button>
            <button 
              onClick={() => setIsAddingUser(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-4 items-start">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-200 font-bold">
            !
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-slate-900 dark:text-white">Pre-seeded demo accounts</p>
            <p className="text-slate-600 dark:text-slate-300">Use the demo developer (<code>demo.dev@automationhub.local</code> / <code>demo1234</code>) and demo employee (<code>demo.user@automationhub.local</code> / <code>demo1234</code>) to smoke test the app. Create real employees, promote at least one to developer, then remove the demo accounts.</p>
            {!hasDemoUsers && users.length > 0 && (
              <p className="text-green-600 dark:text-green-300 font-semibold">Demo accounts already removed.</p>
            )}
          </div>
        </div>

        {banner && (
          <div className="px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200">
            {banner}
          </div>
        )}

        {isAddingUser && (
           <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-indigo-200 dark:border-indigo-700 shadow-sm animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4">Add New Employee</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Full Name</label>
                    <input type="text" required className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Email</label>
                    <input type="email" required className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="john@design.com" />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Password</label>
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm pr-8" 
                        value={newUser.password} 
                        onChange={e => setNewUser({...newUser, password: e.target.value})} 
                        placeholder="********" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-7 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        {showPassword ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Company Role / Title</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm"
                      value={newUser.companyRole}
                      onChange={e => setNewUser({...newUser, companyRole: e.target.value})}
                      placeholder="e.g. Architect, BIM Manager, Engineer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">System Role</label>
                    <select
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm"
                      value={newUser.systemRole}
                      onChange={e => setNewUser({...newUser, systemRole: e.target.value as UserRole})}
                    >
                      <option value={EMPLOYEE_ROLE}>Employee</option>
                      <option value={DEVELOPER_ROLE}>Developer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">Create</button>
                  </div>
              </form>
           </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-200">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Company Role</th>
                <th className="px-6 py-4">System Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
                    <div className="space-y-1">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                      {u.isDemo && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Demo account
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> {u.email}
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-100">{u.companyRole || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === DEVELOPER_ROLE ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'}`}>
                       <Shield className="w-3 h-3" /> {u.role === DEVELOPER_ROLE ? 'Developer' : 'Employee'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex items-center justify-end gap-2">
                        <button 
                          disabled={loadingUserId === u.id.toString() || u.isDemo === true || isCleaningDemo}
                          onClick={() => handleChangeRole(u, u.role === DEVELOPER_ROLE ? EMPLOYEE_ROLE : DEVELOPER_ROLE)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${u.role === DEVELOPER_ROLE ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/40' : 'border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 dark:border-purple-800 dark:text-purple-200 dark:bg-purple-900/20 dark:hover:bg-purple-900/40'} ${loadingUserId === u.id.toString() ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {loadingUserId === u.id.toString() ? 'Updating...' : u.isDemo ? 'Locked' : (u.role === DEVELOPER_ROLE ? 'Demote' : 'Promote to Dev')}
                        </button>
                        <button 
                          disabled={loadingUserId === u.id.toString() || isCleaningDemo}
                          onClick={() => handleDeleteUser(u.id)} 
                          className={`text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition ${loadingUserId === u.id.toString() ? 'opacity-60 cursor-not-allowed' : ''}`} 
                          title="Remove User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
