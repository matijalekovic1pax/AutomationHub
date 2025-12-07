import React, { useState, useEffect } from 'react';
import { Mail, Shield, Trash2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { User, DEVELOPER_ROLE, EMPLOYEE_ROLE } from '../types';
import { getAllUsers, createUser, deleteUser, updateUser } from '../services/authService';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    companyTitle: ''
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
      await createUser(newUser.name, newUser.email, newUser.password, newUser.companyTitle);
      setNewUser({ name: '', email: '', password: '', companyTitle: '' });
      setIsAddingUser(false);
      await loadUsers();
      setBanner('User added as Employee. Promote from the list if needed.');
    } catch (err: any) {
      setBanner(err.message || 'Failed to add user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this user?');
    if (!confirmed) return;
    try {
      await deleteUser(id);
      await loadUsers();
      setIsAddingUser(false);
      setBanner('User removed and list refreshed');
    } catch (err: any) {
      setBanner(err.message || 'Failed to remove user');
      await loadUsers();
    }
  };

  const handleToggleRole = async (user: User) => {
    const nextRole: User['role'] = user.role === DEVELOPER_ROLE ? EMPLOYEE_ROLE : DEVELOPER_ROLE;
    try {
      await updateUser(user.id, { role: nextRole });
      await loadUsers();
      setBanner(`Updated ${user.name} to ${nextRole === DEVELOPER_ROLE ? 'Developer' : 'Employee'}`);
    } catch (err: any) {
      setBanner(err.message || 'Failed to update role');
    }
  };

  return (
      <div className="space-y-6 text-slate-900 dark:text-slate-100">
        <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
            <p className="text-slate-500 dark:text-slate-300 mt-1">Create employee accounts, approve them, and use promotions to grant or revoke Developer access.</p>
          </div>
          <button 
            onClick={() => setIsAddingUser(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
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
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Company Title</label>
                    <input type="text" required className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm" value={newUser.companyTitle} onChange={e => setNewUser({...newUser, companyTitle: e.target.value})} placeholder="e.g. BIM Manager" />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Password</label>
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-md text-sm pr-8" 
                        value={newUser.password} 
                        onChange={e => setNewUser({...newUser, password: e.target.value})} 
                        placeholder="******" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-7 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                        {showPassword ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                    </button>
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
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${u.role === DEVELOPER_ROLE ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'}`}>
                            <Shield className="w-3 h-3" /> {u.role === DEVELOPER_ROLE ? 'Developer' : 'Employee'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Company title: {u.companyTitle || 'Not provided'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /> {u.email}
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => handleToggleRole(u)} 
                         className="text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-2 rounded-lg text-xs font-semibold border border-indigo-100 dark:border-indigo-800 transition"
                         title={u.role === DEVELOPER_ROLE ? 'Demote to employee' : 'Promote to developer'}
                       >
                         {u.role === DEVELOPER_ROLE ? 'Demote' : 'Promote'}
                       </button>
                       <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition" title="Remove User">
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
