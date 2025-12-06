import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

interface Props {
  onShowRegistration: () => void;
}

export const Login: React.FC<Props> = ({ onShowRegistration }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const performLogin = async (emailToUse: string, passwordToUse: string) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(emailToUse, passwordToUse);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleDemoLogin = async (type: 'dev' | 'employee') => {
    const creds = type === 'dev'
      ? { email: 'dev@code.com', password: 'python' }
      : { email: 'arch@design.com', password: 'revit' };
    setEmail(creds.email);
    setPassword(creds.password);
    await performLogin(creds.email, creds.password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="bg-slate-900 dark:bg-slate-950 p-8 text-center">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-indigo-900/50">
            <Box className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Automation <span className="text-indigo-400">Hub</span></h1>
          <p className="text-slate-400 mt-2 text-sm">Automation Request Portal</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Work Email</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none pr-10"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Use preloaded demo accounts</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">Remove after onboarding</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDemoLogin('dev')}
                  className="w-full px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 font-semibold transition"
                >
                  Demo Developer
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDemoLogin('employee')}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold transition"
                >
                  Demo Employee
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                Developer: dev@code.com / python | Employee: arch@design.com / revit
              </p>
            </div>

            <div className="text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Don't have an account?
              </div>
              <button
                type="button"
                onClick={onShowRegistration}
                className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 py-2.5 rounded-lg font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
              >
                Request Access
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
