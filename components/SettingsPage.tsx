import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Bell, Shield, Moon, Save, Loader2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      alert("Settings saved successfully!");
    }, 800);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" /> Profile Information
          </h2>
          <p className="text-sm text-slate-500 mt-1">Update your account details and profile.</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <img src={user?.avatar} alt={user?.name} className="w-20 h-20 rounded-full border-4 border-slate-50 shadow-sm" />
            <div>
              <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition">
                Change Avatar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
              <input 
                type="text" 
                defaultValue={user?.name}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-600 bg-slate-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
              <input 
                type="email" 
                defaultValue={user?.email}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-600 bg-slate-50"
                readOnly
              />
            </div>
             <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
              <input 
                type="text" 
                defaultValue={user?.role}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg outline-none text-slate-500 bg-slate-100"
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" /> Preferences
          </h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Email Notifications</p>
                <p className="text-sm text-slate-500">Receive emails about request updates</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={notifications} onChange={() => setNotifications(!notifications)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="bg-purple-50 p-2 rounded-lg text-purple-600">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-slate-900">Dark Mode</p>
                <p className="text-sm text-slate-500">Use a dark theme for the interface</p>
              </div>
            </div>
             <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};