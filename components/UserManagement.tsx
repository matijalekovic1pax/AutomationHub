import React, { useState, useEffect } from 'react';
import { Mail, Shield, Trash2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { User, UserRole } from '../types';
import { getAllUsers, createUser, deleteUser } from '../services/authService';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newUser, setNewUser] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: UserRole.ARCHITECT 
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
      await createUser(newUser.name, newUser.email, newUser.password, newUser.role);
      setNewUser({ name: '', email: '', password: '', role: UserRole.ARCHITECT });
      setIsAddingUser(false);
      loadUsers();
      alert('User added successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      await deleteUser(id);
      loadUsers();
    }
  };

  return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-slate-500 mt-1">Create and manage accounts for architects and developers.</p>
          </div>
          <button 
            onClick={() => setIsAddingUser(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add Employee
          </button>
        </div>

        {isAddingUser && (
           <div className="bg-white p-6 rounded-xl border border-indigo-200 shadow-sm animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold text-slate-900 mb-4">Add New Employee</h3>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input type="text" required className="w-full px-3 py-2 bg-white text-slate-900 border rounded-md text-sm" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input type="email" required className="w-full px-3 py-2 bg-white text-slate-900 border rounded-md text-sm" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} placeholder="john@design.com" />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                    <input 
                        type={showPassword ? "text" : "password"} 
                        required 
                        className="w-full px-3 py-2 bg-white text-slate-900 border rounded-md text-sm pr-8" 
                        value={newUser.password} 
                        onChange={e => setNewUser({...newUser, password: e.target.value})} 
                        placeholder="••••••" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-7 text-slate-400 hover:text-slate-600">
                        {showPassword ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                    </button>
                  </div>
                   <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                    <select className="w-full px-3 py-2 bg-white text-slate-900 border rounded-md text-sm" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                      <option value={UserRole.ARCHITECT}>Architect</option>
                      <option value={UserRole.DEVELOPER}>Developer</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                    <button type="submit" className="flex-1 px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700">Create</button>
                  </div>
              </form>
           </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full border border-slate-200" />
                    <span className="font-medium text-slate-900">{u.name}</span>
                  </td>
                  <td className="px-6 py-4 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {u.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${u.role === UserRole.DEVELOPER ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                       <Shield className="w-3 h-3" /> {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="Remove User">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}