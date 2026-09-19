import React, { useState } from 'react';
import { Github, Heart, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onStudentAuth: (studentId: string) => void;
  onAdminAuth: (passcode: string) => Promise<boolean>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onStudentAuth, onAdminAuth }) => {
  const [role, setRole] = useState<'student' | 'admin'>('student');
  const [studentId, setStudentId] = useState<string>('');
  const [passcode, setPasscode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (role === 'student') {
      const cleanId = studentId.trim();
      if (!/^\d{5}$/.test(cleanId)) {
        setError('Student ID must be exactly 5 digits (e.g. 10102).');
        return;
      }
      onStudentAuth(cleanId);
    } else {
      if (!passcode.trim()) {
        setError('Please enter the admin passcode.');
        return;
      }
      setLoading(true);
      const success = await onAdminAuth(passcode);
      setLoading(false);
      if (!success) {
        setError('Incorrect admin passcode.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#121215] text-zinc-100 flex flex-col justify-between select-none">
      {/* Centered Modal Card (Matching sc-sign-in.png) */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 sm:p-10 shadow-2xl flex flex-col space-y-8">
          {/* Segmented Control Pill */}
          <div className="bg-[#121214] p-1.5 rounded-xl border border-[#27272a] grid grid-cols-2 gap-1 font-mono text-sm">
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setError(null);
              }}
              className={`py-2.5 rounded-lg font-medium transition-all ${
                role === 'student'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setError(null);
              }}
              className={`py-2.5 rounded-lg font-medium transition-all ${
                role === 'admin'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Admin
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {role === 'student' ? (
              <div>
                <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                  Student ID
                </label>
                <input
                  type="text"
                  autoFocus
                  maxLength={5}
                  inputMode="numeric"
                  placeholder="10102"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value.replace(/\D/g, '').slice(0, 5));
                    setError(null);
                  }}
                  className="w-full px-4 py-3.5 bg-[#121214] border border-[#27272a] rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2">
                    Admin Passcode
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="••••••••"
                    value={passcode}
                    onChange={(e) => {
                      setPasscode(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-4 py-3.5 bg-[#121214] border border-[#27272a] rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-zinc-600 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all"
                  />
                  <p className="text-[11px] font-mono text-zinc-500 mt-1">
                    Default code is 9999
                  </p>
                </div>
              </div>
            )}

            {/* Continue Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-white hover:bg-zinc-200 active:scale-[0.99] text-zinc-950 font-mono font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>

      {/* Footer Matching sc-sign-in.png */}
      <footer className="h-12 border-t border-[#27272a] px-6 flex items-center justify-between text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-1.5">
          <span>Made with</span>
          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
          <span>by</span>
          <span className="text-zinc-300 underline underline-offset-4 decoration-zinc-600">Robotics Team</span>
        </div>

        <a
          href="https://codeberg.org/tendulkar/attendance"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-500 hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
        </a>
      </footer>
    </div>
  );
};
