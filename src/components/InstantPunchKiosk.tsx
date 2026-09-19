import React, { useState, useEffect, useRef } from 'react';
import { PunchResponse } from '../types/attendance';
import { CheckCircle2, AlertCircle, Clock, UserCheck, Lock } from 'lucide-react';

interface InstantPunchKioskProps {
  isLocked: boolean;
  onPunchSuccess: () => void;
}

interface PunchBannerInfo {
  type: 'in' | 'out';
  memberName: string;
  memberId: string;
  time: string;
  duration?: string;
}

export const InstantPunchKiosk: React.FC<InstantPunchKioskProps> = ({
  isLocked,
  onPunchSuccess,
}) => {
  const [idInput, setIdInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackBanner, setFeedbackBanner] = useState<PunchBannerInfo | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus ID input on mount and whenever terminal state changes
  useEffect(() => {
    if (!isLocked) {
      idInputRef.current?.focus();
    }
  }, [isLocked]);

  const triggerPunch = async (memberId: string): Promise<void> => {
    if (isProcessing) return;
    if (isLocked) {
      setErrorBanner('Terminal is locked. An authorized Lead must unlock the terminal.');
      return;
    }

    setIsProcessing(true);
    setErrorBanner(null);

    try {
      const response = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId }),
      });

      const data = await response.json() as PunchResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Punch failed');
      }

      // Clear previous banner timer
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
      }

      if (data.action === 'clock_in') {
        const timeFormatted = data.timeIn
          ? new Date(data.timeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setFeedbackBanner({
          type: 'in',
          memberName: data.member.name,
          memberId: data.member.id,
          time: timeFormatted,
        });
      } else {
        const timeFormatted = data.timeOut
          ? new Date(data.timeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const mins = data.durationMinutes ?? 0;
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        const durationFormatted = `${hours}h ${remMins}m`;

        setFeedbackBanner({
          type: 'out',
          memberName: data.member.name,
          memberId: data.member.id,
          time: timeFormatted,
          duration: durationFormatted,
        });
      }

      // Reset feedback after 5 seconds
      bannerTimerRef.current = setTimeout(() => {
        setFeedbackBanner(null);
      }, 5000);

      setIdInput('');
      onPunchSuccess();

      setTimeout(() => {
        idInputRef.current?.focus();
      }, 50);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Punch action failed');
      setIdInput('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle 5-digit auto-punch
  const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    setIdInput(val);
    setErrorBanner(null);

    // Instant trigger when 5 digits are reached
    if (val.length === 5) {
      void triggerPunch(val);
    }
  };

  const handleIdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && idInput.trim().length === 5) {
      e.preventDefault();
      void triggerPunch(idInput.trim());
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {isLocked ? (
        <div className="border border-notion-border bg-notion-surface/50 rounded p-8 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded bg-[#FBE4E4] text-[#932C2C]">
            <Lock className="w-4 h-4" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold text-notion-text">Attendance Recording Locked</h2>
          <p className="text-xs text-notion-muted max-w-sm mx-auto leading-relaxed">
            A designated Lead must unlock the terminal using their Lead PIN before members can sign in or out.
          </p>
        </div>
      ) : (
        <div className="border border-notion-border bg-white rounded-lg p-6 space-y-5 shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="kiosk-id-input" className="text-xs font-semibold uppercase tracking-wider text-notion-text">
                Enter 5-Digit ID
              </label>
              <span className="text-[11px] text-notion-muted font-mono">
                Auto-records at 5 digits
              </span>
            </div>

            <div className="relative">
              <input
                id="kiosk-id-input"
                ref={idInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={idInput}
                onChange={handleIdChange}
                onKeyDown={handleIdKeyDown}
                disabled={isProcessing}
                placeholder="e.g. 10101"
                className="w-full px-4 py-3 text-2xl font-mono text-center tracking-[0.35em] text-notion-text border border-notion-border rounded-md bg-notion-surface/30 focus:border-[#37352F] focus:bg-white placeholder:text-notion-subtle placeholder:tracking-normal placeholder:font-sans placeholder:text-sm transition-all"
              />
              <div className="absolute right-3.5 top-4 text-xs text-notion-muted font-mono pointer-events-none">
                {idInput.length}/5
              </div>
            </div>

            <p className="text-xs text-notion-muted text-center mt-2.5">
              Type your 5-digit ID to clock in. Type it again to clock out.
            </p>
          </div>

          {/* Feedback Flash Banners */}
          {feedbackBanner && (
            <div
              className={`p-3.5 rounded border text-xs flex items-center justify-between transition-all ${
                feedbackBanner.type === 'in'
                  ? 'bg-[#EDF3EC] border-[#D5E6D3] text-[#2B593F]'
                  : 'bg-[#E7F3F8] border-[#CFE4EE] text-[#28456C]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedbackBanner.type === 'in' ? (
                  <UserCheck className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                )}
                <div>
                  <span className="font-semibold">{feedbackBanner.memberName}</span>
                  <span className="font-mono ml-1 opacity-80">({feedbackBanner.memberId})</span>
                  {' '}
                  {feedbackBanner.type === 'in' ? (
                    <span>clocked <strong>IN</strong> at {feedbackBanner.time}</span>
                  ) : (
                    <span>
                      clocked <strong>OUT</strong> at {feedbackBanner.time}
                      {feedbackBanner.duration && (
                        <span className="ml-2 font-mono bg-white/70 px-1.5 py-0.5 rounded text-[11px]">
                          Duration: {feedbackBanner.duration}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] opacity-75 shrink-0">
                <Clock className="w-3 h-3" strokeWidth={1.5} />
                Recorded
              </div>
            </div>
          )}

          {errorBanner && (
            <div className="p-3 rounded border border-[#F6C6C6] bg-[#FBE4E4] text-[#932C2C] text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span>{errorBanner}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
