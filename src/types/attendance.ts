export interface Member {
  id: string; // 5 digits (e.g., "10101")
  name: string;
  role: 'member' | 'lead';
  isClockedIn: boolean;
  activeSessionStart?: string;
}

export interface AttendanceEntry {
  id: string;
  memberId: string;
  memberName: string;
  date: string; // YYYY-MM-DD
  timeIn: string; // ISO string
  timeOut?: string; // ISO string
  durationMinutes?: number;
  status: 'active' | 'completed';
}

export interface PunchResponse {
  action: 'clock_in' | 'clock_out';
  member: {
    id: string;
    name: string;
  };
  timeIn?: string;
  timeOut?: string;
  durationMinutes?: number;
}
