import React, { useState } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound, X } from 'lucide-react';

interface LeadLockBarProps {
  isLocked: boolean;
  onLockToggle: () => Promise<void>;
  onUnlockSuccess: () => void;
}

export const LeadLockBar: React.FC<LeadLockBarProps> = ({
  isLocked,
  onLockToggle,
  onUnlockSuccess,
}) => {
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleUnlockSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/terminal/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });

      const data = await response.json() as { success?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      setPinInput('');
      setShowPinModal(false);
      onUnlockSuccess();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unlock failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="border-b border-notion-border bg-white px-6 py-3 flex items-center justify-between">
        {/* Notion Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-notion-muted">
          <span className="hover:text-notion-text cursor-pointer transition-colors">Workspace</span>
          <span>/</span>
          <span className="text-notion-text font-medium flex items-center gap-1.5">
            Attendance Terminal
          </span>
        </div>

        {/* Lock Status & Action */}
        <div className="flex items-center space-x-3">
          {isLocked ? (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-[#FBE4E4] text-[#932C2C] border border-[#F6C6C6]">
                <Lock className="w-3 h-3" strokeWidth={1.75} />
                Terminal Locked
              </span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setPinInput('');
                  setShowPinModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-notion-text bg-white border border-notion-border rounded hover:bg-notion-surface transition-colors shadow-none"
              >
                <KeyRound className="w-3.5 h-3.5 text-notion-muted" strokeWidth={1.5} />
                Unlock Terminal
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded bg-[#EDF3EC] text-[#2B593F] border border-[#D5E6D3]">
                <Unlock className="w-3 h-3" strokeWidth={1.75} />
                Terminal Unlocked
              </span>
              <button
                type="button"
                onClick={() => {
                  void onLockToggle();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-notion-muted hover:text-notion-text border border-notion-border rounded hover:bg-notion-surface transition-colors"
                title="Lock terminal to prevent sign-ins"
              >
                <Lock className="w-3 h-3" strokeWidth={1.5} />
                Lock
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Notion Lead Unlock Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25">
          <div className="bg-white border border-notion-border rounded-lg shadow-lg w-full max-w-sm p-5 relative">
            <button
              type="button"
              onClick={() => setShowPinModal(false)}
              className="absolute top-4 right-4 text-notion-muted hover:text-notion-text"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-notion-text" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-notion-text">Lead Terminal Authorization</h2>
            </div>

            <p className="text-xs text-notion-muted mb-4 leading-relaxed">
              Enter the Lead PIN or a registered 5-digit Lead ID to unlock the attendance kiosk.
            </p>

            <form onSubmit={(e) => { void handleUnlockSubmit(e); }}>
              <div className="mb-3">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  placeholder="Enter PIN (Default: 9999)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-notion-border rounded focus:border-[#37352F] bg-notion-surface/40 placeholder:text-notion-subtle transition-colors"
                  disabled={isSubmitting}
                />
              </div>

              {errorMsg && (
                <div className="mb-3 text-xs text-[#932C2C] bg-[#FBE4E4]/60 px-2.5 py-1.5 rounded border border-[#F6C6C6]">
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3 py-1.5 text-xs text-notion-muted hover:text-notion-text border border-notion-border rounded hover:bg-notion-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !pinInput.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#37352F] hover:bg-[#201F1D] disabled:opacity-50 rounded transition-colors"
                >
                  {isSubmitting ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
