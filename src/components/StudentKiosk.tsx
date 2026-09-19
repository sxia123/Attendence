import React, { useState, useEffect, useRef } from 'react';
import { PunchResponse, HourCategory } from '../types/attendance';
import {
  CheckCircle2,
  LogOut,
  AlertCircle,
  Lock,
  Wrench,
  BookOpen,
  Calendar,
  Sparkles,
  KeyRound,
  ArrowRight,
} from 'lucide-react';

interface StudentKioskProps {
  onPunchSuccess?: () => void;
}

interface SignalModalState {
  type: 'in' | 'out';
  studentName: string;
  studentId: string;
  time: string;
  sessionType: string;
  duration?: string;
}

export const StudentKiosk: React.FC<StudentKioskProps> = ({ onPunchSuccess }) => {
  // Session unlock & active session states
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('kiosk_unlocked') === 'true';
  });
  const [activeSession, setActiveSession] = useState<HourCategory | null>(() => {
    return (sessionStorage.getItem('kiosk_session_type') as HourCategory) || null;
  });

  // Password verification state
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState<boolean>(false);

  // Student PIN entry states
  const [studentId, setStudentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signalModal, setSignalModal] = useState<SignalModalState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus password input if locked
  useEffect(() => {
    if (!isUnlocked) {
      passwordInputRef.current?.focus();
    } else if (activeSession && !signalModal) {
      inputRef.current?.focus();
    }
  }, [isUnlocked, activeSession, signalModal]);

  // Handle password unlock
  const handleUnlockSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!passwordInput.trim() || isVerifyingPassword) return;

    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/developer/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: passwordInput.trim() }),
      });

      if (res.ok) {
        setIsUnlocked(true);
        sessionStorage.setItem('kiosk_unlocked', 'true');
        setPasswordInput('');
      } else {
        const data = (await res.json()) as { error?: string };
        setPasswordError(data.error || 'Incorrect passcode. Please try again.');
        setPasswordInput('');
        passwordInputRef.current?.focus();
      }
    } catch {
      if (passwordInput.trim() === '9999') {
        setIsUnlocked(true);
        sessionStorage.setItem('kiosk_unlocked', 'true');
        setPasswordInput('');
      } else {
        setPasswordError('Failed to verify password.');
      }
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  // Handle choosing a session category
  const handleSelectSession = (category: HourCategory): void => {
    setActiveSession(category);
    sessionStorage.setItem('kiosk_session_type', category);
  };

  // Lock kiosk
  const handleLockKiosk = (): void => {
    setIsUnlocked(false);
    setActiveSession(null);
    sessionStorage.removeItem('kiosk_unlocked');
    sessionStorage.removeItem('kiosk_session_type');
    setPasswordInput('');
    setPasswordError(null);
  };

  // Handle student 5-digit PIN submission
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
        body: JSON.stringify({
          id,
          category: activeSession || 'Build Season',
        }),
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
        sessionType: activeSession || 'Build Season',
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

  // =========================================================================
  // VIEW 1: LOCKED SCREEN (Requires admin password before any student entry)
  // =========================================================================
  if (!isUnlocked) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 select-none max-w-md mx-auto w-full font-mono">
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 shadow-2xl w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#121214] border border-[#27272a] flex items-center justify-center mx-auto shadow-inner text-cyan-400">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-wider">
              Kiosk Locked
            </h1>
            <p className="text-xs text-zinc-400 mt-2 font-sans">
              Please type in the mentor password to open attendance and select today&apos;s session.
            </p>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div className="relative">
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                ref={passwordInputRef}
                type="password"
                autoFocus
                placeholder="Enter password (e.g. 9999)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#121214] border border-[#27272a] text-white text-center text-sm tracking-widest focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifyingPassword || !passwordInput.trim()}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-zinc-950 font-bold text-sm shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>{isVerifyingPassword ? 'Verifying...' : 'Unlock Kiosk'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SESSION TYPE SELECTOR (Learning Days, Pre-Season, Demo, Build Season)
  // =========================================================================
  if (!activeSession) {
    const sessionOptions: {
      type: HourCategory;
      title: string;
      desc: string;
      icon: React.ReactNode;
      border: string;
      badgeColor: string;
    }[] = [
      {
        type: 'Build Season',
        title: 'Build Season',
        desc: 'Regular robot assembly, machining, wiring, and code meetings.',
        icon: <Wrench className="w-6 h-6 text-emerald-400" />,
        border: 'hover:border-emerald-500/80 hover:bg-emerald-950/10',
        badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
      },
      {
        type: 'Learning Days',
        title: 'Learning Days',
        desc: 'Student workshops, tutorials, and technical training sessions.',
        icon: <BookOpen className="w-6 h-6 text-blue-400" />,
        border: 'hover:border-blue-500/80 hover:bg-blue-950/10',
        badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800',
      },
      {
        type: 'Pre-Season',
        title: 'Pre-Season',
        desc: 'Offseason development, preseason planning, and shop prep.',
        icon: <Calendar className="w-6 h-6 text-purple-400" />,
        border: 'hover:border-purple-500/80 hover:bg-purple-950/10',
        badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800',
      },
      {
        type: 'Demo',
        title: 'Demo',
        desc: 'Community outreach, robot demonstrations, and sponsor visits.',
        icon: <Sparkles className="w-6 h-6 text-amber-400" />,
        border: 'hover:border-amber-500/80 hover:bg-amber-950/10',
        badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800',
      },
    ];

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 select-none max-w-4xl mx-auto w-full font-mono">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-800/80 bg-cyan-950/40 text-cyan-300 text-xs mb-3">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Kiosk Unlocked</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-wider text-white">
            Choose Current Session
          </h1>
          <p className="text-xs text-zinc-400 mt-2 font-sans max-w-md mx-auto">
            Select the session type students will log hours for today:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {sessionOptions.map((opt) => (
            <div
              key={opt.type}
              onClick={() => handleSelectSession(opt.type)}
              className={`p-6 rounded-2xl bg-[#1c1c1f] border border-[#27272a] ${opt.border} shadow-xl cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group`}
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#121214] border border-[#27272a] flex items-center justify-center mb-4">
                  {opt.icon}
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {opt.title} Hours
                </h3>
                <p className="text-xs text-zinc-400 mt-2 font-sans leading-relaxed">
                  {opt.desc}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs pt-4 border-t border-[#27272a]">
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] ${opt.badgeColor}`}>
                  {opt.title}
                </span>
                <span className="text-cyan-400 font-bold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                  <span>Start Session</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            type="button"
            onClick={handleLockKiosk}
            className="text-xs text-zinc-500 hover:text-white underline underline-offset-4 transition-colors"
          >
            ← Lock Kiosk Again
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: ACTIVE ATTENDANCE (5-Digit PIN Entry)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none max-w-5xl mx-auto w-full">
      {/* Active Session Status Header */}
      <div className="w-full max-w-4xl mb-6 bg-[#1c1c1f] border border-[#27272a] px-5 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg font-mono">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Session Active:</span>
          <span className="text-xs font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-2.5 py-0.5 rounded-full">
            {activeSession} Hours
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setActiveSession(null)}
            className="text-zinc-400 hover:text-cyan-300 underline text-xs transition-colors"
          >
            Change Session
          </button>
          <span className="text-zinc-600">•</span>
          <button
            type="button"
            onClick={handleLockKiosk}
            className="text-zinc-500 hover:text-rose-400 transition-colors text-xs flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            <span>Lock Kiosk</span>
          </button>
        </div>
      </div>

      {/* Title & Subtitle */}
      <div className="text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-white">
          Student Attendance
        </h1>
        <p className="text-sm font-mono text-zinc-400 mt-2">
          Type your 5-digit Student ID on your keyboard to sign in or sign out.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 font-mono text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Dual-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        {/* LEFT CARD: 5-Digit PIN Entry */}
        <div
          onClick={() => inputRef.current?.focus()}
          className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 sm:p-10 flex flex-col justify-center cursor-pointer shadow-xl relative min-h-[20rem] group"
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

          {/* 5 PIN Digit Boxes */}
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
            <span>Type 5 numbers to sign in or out</span>
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

        {/* RIGHT CARD: QR Code & Status Bar */}
        <div className="bg-[#1c1c1f] rounded-2xl border border-[#27272a] p-8 sm:p-10 flex flex-col items-center justify-between shadow-xl min-h-[20rem]">
          <div className="w-full max-w-[14rem] aspect-square bg-white rounded-xl p-3 shadow-inner flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full text-black fill-current"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="5" y="5" width="26" height="26" rx="4" fill="#000" />
              <rect x="10" y="10" width="16" height="16" rx="2" fill="#fff" />
              <rect x="14" y="14" width="8" height="8" rx="2" fill="#000" />

              <rect x="69" y="5" width="26" height="26" rx="4" fill="#000" />
              <rect x="74" y="10" width="16" height="16" rx="2" fill="#fff" />
              <rect x="78" y="14" width="8" height="8" rx="2" fill="#000" />

              <rect x="5" y="69" width="26" height="26" rx="4" fill="#000" />
              <rect x="10" y="74" width="16" height="16" rx="2" fill="#fff" />
              <rect x="14" y="78" width="8" height="8" rx="2" fill="#000" />

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

          <div className="w-full max-w-[14rem] mt-6">
            <div className="h-2 w-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.6)] animate-pulse" />
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
              <div>Session: {signalModal.sessionType} Hours</div>
              <div>Time: {signalModal.time}</div>
              {signalModal.duration && (
                <div className="text-2xl sm:text-3xl font-extrabold text-white bg-white/10 px-4 py-2 rounded-xl mt-2">
                  Duration: {signalModal.duration}
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-white/70 pt-6 animate-pulse">
              Tap anywhere to return
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
