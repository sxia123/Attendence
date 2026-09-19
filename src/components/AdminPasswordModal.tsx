import React, { useState, useEffect, useRef } from 'react';
import { Lock, AlertCircle, X } from 'lucide-react';

interface AdminPasswordModalProps {
  targetTabName?: string;
  title?: string;
  description?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  targetTabName,
  title = 'Admin Access',
  description,
  onSuccess,
  onCancel,
}) => {
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/developer/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: password.trim() }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-mono animate-in fade-in select-none">
      <div className="w-full max-w-sm bg-[#1c1c1f] rounded-2xl border border-[#27272a] shadow-2xl p-6 sm:p-8 space-y-6 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#121214] border border-[#27272a] text-zinc-300 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">
            {title}
          </h2>
          <p className="text-xs text-zinc-400">
            {description || (
              <>
                Enter the admin password to open{' '}
                <span className="text-white font-semibold">{targetTabName}</span>.
              </>
            )}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-3 bg-[#121214] border border-[#27272a] rounded-xl text-center text-white font-mono text-xl tracking-widest placeholder:text-zinc-600 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 outline-none transition-all"
            />
            <div className="text-[11px] text-zinc-500 text-center mt-1.5">
              Default password is 9999
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-[#27272a] text-zinc-400 hover:text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all shadow-md disabled:opacity-40"
            >
              {loading ? 'Checking...' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
