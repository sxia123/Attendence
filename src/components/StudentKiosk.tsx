import React, { useState, useEffect, useRef } from 'react';
import { PunchResponse } from '../types/attendance';
import { CheckCircle2, LogOut, AlertCircle } from 'lucide-react';

interface StudentKioskProps {
  onPunchSuccess?: () => void;
  sessionTitle?: string;
}

interface SignalModalState {
  type: 'in' | 'out';
  studentName: string;
  studentId: string;
  time: string;
  duration?: string;
}

export const StudentKiosk: React.FC<StudentKioskProps> = ({
  onPunchSuccess,
  sessionTitle = 'Build Season',
}) => {
  const [studentId, setStudentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signalModal, setSignalModal] = useState<SignalModalState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus hidden input on mount and whenever modal closes
  useEffect(() => {
    if (!signalModal) {
      inputRef.current?.focus();
    }
  }, [signalModal]);

  const handleSubmit = async (idToSubmit?: string): Promise<void> => {
    const id = (idToSubmit || studentId).trim();
    if (!id || id.length !== 5 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/punch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = (await response.json()) as PunchResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Attendance punch failed.');
      }

      const timeInOrOut = data.action === 'clock_in' ? data.timeIn : data.timeOut;
      const formattedTime = timeInOrOut
        ? new Date(timeInOrOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Trigger full-screen visual signal
      setSignalModal({
        type: data.action === 'clock_in' ? 'in' : 'out',
        studentName: data.student.name,
        studentId: data.student.id,
        time: formattedTime,
        duration: data.durationFormatted,
      });

      setStudentId('');
      onPunchSuccess?.();

      // Auto close after 3.5 seconds
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      autoCloseTimerRef.current = setTimeout(() => {
        setSignalModal(null);
      }, 3500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred.');
      setStudentId('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSignalModalNow = (): void => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    setSignalModal(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none max-w-6xl mx-auto w-full">
      {/* Top Monospaced Title (Matching sc-attendance.png) */}
      <h1 className="text-3xl sm:text-5xl font-mono font-bold tracking-widest text-white mb-10 text-center">
        {sessionTitle}
      </h1>

      {/* Error Message */}
      {errorMessage && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 font-mono text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Dual-Card Grid (Matching sc-attendance.png) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* LEFT CARD: 5-Digit PIN Entry */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 sm:p-10 flex flex-col justify-center cursor-pointer shadow-xl relative min-h-[22rem] group"
        >
          {/* Hidden hardware input */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={5}
            value={studentId}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 5);
              setStudentId(val);
              setErrorMessage(null);
              if (val.length === 5) {
                void handleSubmit(val);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && studentId.length === 5) {
                void handleSubmit();
              }
            }}
            className="sr-only"
            aria-label="Student ID"
          />

          <label className="text-xs font-mono text-zinc-400 uppercase tracking-widest mb-6 block">
            Student ID
          </label>

          {/* 5 PIN Digit Boxes matching screenshot */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 my-auto">
            {[0, 1, 2, 3, 4].map((index) => {
              const char = studentId[index];
              const isCurrent = studentId.length === index;
              return (
                <div
                  key={index}
                  className={`w-12 h-16 sm:w-16 sm:h-20 rounded-xl flex items-center justify-center text-3xl sm:text-4xl font-mono font-bold transition-all ${
                    char
                      ? 'bg-zinc-800 text-white border-2 border-zinc-600 shadow-md'
                      : isCurrent
                      ? 'bg-[#121214] border-2 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.25)] animate-pulse'
                      : 'bg-[#121214] border border-[#27272a] text-zinc-600'
                  }`}
                >
                  {char || ''}
                </div>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-zinc-500 mt-6 flex justify-between items-center">
            <span>Type 5 digits to clock in / out</span>
            {studentId.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStudentId('');
                  inputRef.current?.focus();
                }}
                className="text-zinc-400 hover:text-white underline underline-offset-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* RIGHT CARD: QR Code & Active Progress Line */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 sm:p-10 flex flex-col items-center justify-between shadow-xl min-h-[22rem]">
          {/* Stylized QR Code matching screenshot */}
          <div className="w-full max-w-[15rem] aspect-square bg-white rounded-xl p-3 shadow-inner flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full text-black fill-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Corner squares */}
              <rect x="5" y="5" width="26" height="26" rx="4" fill="#000" />
              <rect x="10" y="10" width="16" height="16" rx="2" fill="#fff" />
              <rect x="14" y="14" width="8" height="8" rx="2" fill="#000" />

              <rect x="69" y="5" width="26" height="26" rx="4" fill="#000" />
              <rect x="74" y="10" width="16" height="16" rx="2" fill="#fff" />
              <rect x="78" y="14" width="8" height="8" rx="2" fill="#000" />

              <rect x="5" y="69" width="26" height="26" rx="4" fill="#000" />
              <rect x="10" y="74" width="16" height="16" rx="2" fill="#fff" />
              <rect x="14" y="78" width="8" height="8" rx="2" fill="#000" />

              {/* Data modules */}
              <rect x="36" y="8" width="8" height="6" rx="1" />
              <rect x="48" y="6" width="6" height="8" rx="1" />
              <rect x="58" y="12" width="6" height="6" rx="1" />
              <rect x="36" y="20" width="6" height="12" rx="1" />
              <rect x="48" y="18" width="12" height="6" rx="1" />

              <rect x="8" y="38" width="14" height="6" rx="1" />
              <rect x="28" y="38" width="6" height="14" rx="1" />
              <rect x="38" y="36" width="12" height="6" rx="1" />
              <rect x="56" y="38" width="8" height="14" rx="1" />
              <rect x="68" y="36" width="12" height="8" rx="1" />
              <rect x="84" y="38" width="10" height="6" rx="1" />

              <rect x="8" y="52" width="8" height="10" rx="1" />
              <rect x="20" y="48" width="6" height="14" rx="1" />
              <rect x="36" y="48" width="14" height="8" rx="1" />
              <rect x="46" y="62" width="8" height="12" rx="1" />
              <rect x="68" y="50" width="8" height="14" rx="1" />
              <rect x="82" y="52" width="12" height="8" rx="1" />

              <rect x="36" y="68" width="6" height="12" rx="1" />
              <rect x="48" y="80" width="12" height="8" rx="1" />
              <rect x="66" y="70" width="10" height="8" rx="1" />
              <rect x="80" y="68" width="12" height="12" rx="1" />
              <rect x="68" y="84" width="8" height="10" rx="1" />
              <rect x="84" y="86" width="10" height="8" rx="1" />
            </svg>
          </div>

          {/* Glowing Status Bar underneath */}
          <div className="w-full max-w-[15rem] mt-6">
            <div className="h-2.5 w-full bg-white rounded-full shadow-[0_0_12px_rgba(255,255,255,0.4)] animate-pulse" />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* FULL-SCREEN SIGNAL POPUP (GREEN ON SIGN-IN / RED ON SIGN-OUT) */}
      {/* ========================================================= */}
      {signalModal && (
        <div
          onClick={closeSignalModalNow}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 text-white text-center cursor-pointer transition-all duration-300 animate-in fade-in zoom-in-95 ${
            signalModal.type === 'in' ? 'bg-[#059669]' : 'bg-[#e11d48]'
          }`}
        >
          <div className="max-w-xl w-full flex flex-col items-center space-y-6">
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-2xl border-4 border-white/40">
              {signalModal.type === 'in' ? (
                <CheckCircle2 className="w-16 h-16 sm:w-24 sm:h-24 text-white" strokeWidth={2.5} />
              ) : (
                <LogOut className="w-16 h-16 sm:w-24 sm:h-24 text-white" strokeWidth={2.5} />
              )}
            </div>

            <div className="space-y-2">
              <span className="text-sm sm:text-base font-mono uppercase tracking-widest text-white/80">
                {signalModal.type === 'in' ? 'Welcome' : 'Goodbye'}
              </span>
              <h2 className="text-4xl sm:text-6xl font-mono font-bold tracking-tight text-white drop-shadow-md">
                {signalModal.studentName}
              </h2>
            </div>

            <div className="bg-white/20 backdrop-blur-md px-6 py-2.5 rounded-xl border border-white/30 text-xl font-mono font-bold">
              {signalModal.type === 'in' ? '✓ SIGNED IN' : '✓ SIGNED OUT'}
            </div>

            <div className="space-y-1 font-mono text-lg sm:text-xl font-medium text-white/95">
              <div>Time: {signalModal.time}</div>
              {signalModal.duration && (
                <div className="text-2xl sm:text-3xl font-extrabold text-white bg-white/10 px-4 py-2 rounded-xl mt-2">
                  Session: {signalModal.duration}
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-white/70 pt-6 animate-pulse">
              Tap anywhere to continue
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
