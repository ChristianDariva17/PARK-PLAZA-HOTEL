import { authRequest } from '../auth/authClient.js';

export const staffClient = {
  getStaffDirectory: async () => {
    return authRequest('/api/staff');
  },
  
  getStaffProfile: async (id) => {
    return authRequest(`/api/staff/${id}`);
  },

  getAttendanceEvents: async () => {
    return authRequest('/api/attendance/events');
  },

  getKioskQr: async () => {
    return authRequest('/api/attendance/kiosk-qr');
  },

  reportQrAttendance: async (payload) => {
    return authRequest('/api/attendance/scan-qr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reportManualAttendance: async (payload) => {
    return authRequest('/api/attendance/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  reportBiometricAttendance: async (payload) => {
    return authRequest('/api/attendance/biometric', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createStaff: async (payload) => {
    return authRequest('/api/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStaff: async (id, payload) => {
    return authRequest(`/api/staff/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  archiveStaff: async (id, reason) => {
    return authRequest(`/api/staff/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  reactivateStaff: async (id, reason) => {
    return authRequest(`/api/staff/${id}/reactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  createWorkSchedule: async (name, ianaTimezone) => {
    return authRequest('/api/staff/work-schedules', {
      method: 'POST',
      body: JSON.stringify({ name, ianaTimezone }),
    });
  },

  listWorkSchedules: async () => {
    return authRequest('/api/staff/work-schedules');
  },

  assignWorkSchedule: async (staffId, workScheduleId, validFrom, pattern) => {
    return authRequest(`/api/staff/${staffId}/work-schedule-assignments`, {
      method: 'POST',
      body: JSON.stringify({ workScheduleId, validFrom, pattern }),
    });
  },
};
