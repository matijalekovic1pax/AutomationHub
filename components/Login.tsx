import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Box, ArrowRight, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 shadow-lg shadow-indigo-900/50">
                <Box className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Automation <span className="text-indigo-400">Hub</span></h1>
            <p className="text-slate-400 mt-2 text-sm">Automation Request Portal</p>
        </div>
        
        <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Work Email</label>
                    <input 
                        type="email" 
                        required
                        className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                        <input 
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none pr-10"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition flex justify-center items-center gap-2 shadow-sm shadow-indigo-200"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};