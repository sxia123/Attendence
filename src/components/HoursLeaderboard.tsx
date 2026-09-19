import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Student } from '../types/attendance';
import { Trophy } from 'lucide-react';

interface HoursLeaderboardProps {
  onExit?: () => void;
  onGoToEditor?: () => void;
}

export const HoursLeaderboard: React.FC<HoursLeaderboardProps> = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Students
  const fetchStudents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/developer/students');
      if (res.ok) {
        const data = (await res.json()) as Student[];
        setStudents(data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  // Ranked Top 5 Students strictly by total hours (highest to lowest)
  const top5Students = useMemo(() => {
    const list = [...students].sort((a, b) => b.totalMinutes - a.totalMinutes);
    return list.slice(0, 5).map((student, idx) => ({
      ...student,
      rank: idx + 1,
    }));
  }, [students]);

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          icon: '🥇',
          label: '1st',
          border: 'border-amber-500/60 bg-gradient-to-r from-amber-950/25 to-[#1c1c1f]',
          text: 'text-amber-300',
        };
      case 2:
        return {
          icon: '🥈',
          label: '2nd',
          border: 'border-zinc-500/60 bg-gradient-to-r from-zinc-850/40 to-[#1c1c1f]',
          text: 'text-zinc-300',
        };
      case 3:
        return {
          icon: '🥉',
          label: '3rd',
          border: 'border-amber-800/60 bg-gradient-to-r from-amber-950/20 to-[#1c1c1f]',
          text: 'text-amber-500',
        };
      default:
        return {
          icon: null,
          label: `#${rank}`,
          border: 'border-[#27272a] bg-[#1c1c1f]',
          text: 'text-zinc-400',
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 select-none max-w-xl mx-auto w-full font-mono">
      {/* Heading: Leaderboard */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-[#1c1c1f] border border-[#27272a] flex items-center justify-center mx-auto mb-4 shadow-xl text-amber-400">
          <Trophy className="w-7 h-7" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-wider text-white">
          Leaderboard
        </h1>
        <p className="text-xs text-zinc-400 mt-2">
          Top 5 members
        </p>
      </div>

      {/* Top 5 List */}
      <div className="w-full space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-zinc-500 text-sm bg-[#1c1c1f] rounded-2xl border border-[#27272a]">
            Loading leaderboard...
          </div>
        ) : top5Students.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm bg-[#1c1c1f] rounded-2xl border border-[#27272a]">
            No members registered yet.
          </div>
        ) : (
          top5Students.map((student) => {
            const badge = getRankBadge(student.rank);

            return (
              <div
                key={student.id}
                className={`p-4 sm:p-5 rounded-2xl border ${badge.border} flex items-center justify-between shadow-lg transition-all hover:scale-[1.01]`}
              >
                {/* Left: Rank & Name */}
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl bg-[#121214] border border-[#27272a] flex items-center justify-center font-bold text-base flex-shrink-0 ${badge.text}`}
                  >
                    {badge.icon || badge.label}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white truncate">
                      {student.name}
                    </h2>
                  </div>
                </div>

                {/* Right: Status */}
                <div>
                  {student.isClockedIn ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded-full font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Present
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 px-3 py-1 rounded-full">
                      Signed Out
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
