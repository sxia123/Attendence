export type HourCategory = 'Build Season' | 'Learning Days' | 'Pre-Season' | 'Demo';

export interface Student {
  id: string; // 5 digits (e.g., "10101")
  name: string;
  isClockedIn: boolean;
  activeSessionStart?: string;
  totalMinutes: number;
  totalHoursFormatted: string;
  sessionsCount?: number;
  buildMinutes?: number;
  learningMinutes?: number;
  preseasonMinutes?: number;
  demoMinutes?: number;
}

export interface AttendanceEntry {
  id: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // ISO string
  timeOut?: string; // ISO string
  durationMinutes?: number;
  status: 'active' | 'completed';
  note?: string;
  category?: HourCategory;
}

export interface PunchResponse {
  action: 'clock_in' | 'clock_out';
  student: {
    id: string;
    name: string;
  };
  timeIn?: string;
  timeOut?: string;
  durationMinutes?: number;
  durationFormatted?: string;
  error?: string;
}

// Legacy alias for smooth transition
export type Member = Student;
