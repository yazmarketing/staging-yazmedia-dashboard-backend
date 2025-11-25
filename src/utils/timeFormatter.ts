/**
 * Format attendance time to 12-hour format with AM/PM
 *
 * IMPORTANT: The backend stores Dubai time directly in the Date object.
 * So we just need to format it as-is, without timezone conversion.
 *
 * Input: "2025-10-22T21:30:09.000Z" (stored as Dubai time)
 * Output: "9:30 PM"
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns Formatted time string in 12-hour format with AM/PM
 */
export const formatAttendanceTime = (isoTime: string | null): string => {
  if (!isoTime) return '--:-- --';

  try {
    const date = new Date(isoTime);
    // Format as 12-hour with AM/PM (e.g., "9:30 PM")
    // The date already contains Dubai time, so we format it directly
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '--:-- --';
  }
};

/**
 * Format attendance time to 12-hour format with seconds and AM/PM
 *
 * Input: "2025-10-22T21:30:09.000Z" (stored as Dubai time)
 * Output: "9:30:09 PM"
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns Formatted time string in 12-hour format with seconds and AM/PM
 */
export const formatAttendanceTimeWithSeconds = (isoTime: string | null): string => {
  if (!isoTime) return '--:-- -- --';

  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '--:-- -- --';
  }
};

/**
 * Format attendance date and time to full format
 *
 * Input: "2025-10-22T21:30:09.000Z" (stored as Dubai time)
 * Output: "Oct 22, 2025 9:30 PM"
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns Formatted date and time string
 */
export const formatAttendanceDateTime = (isoTime: string | null): string => {
  if (!isoTime) return '--/-- ----';

  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting date time:', error);
    return '--/-- ----';
  }
};

/**
 * Format attendance date only
 *
 * Input: "2025-10-22T21:30:09.000Z" (stored as Dubai time)
 * Output: "Oct 22, 2025"
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns Formatted date string
 */
export const formatAttendanceDate = (isoTime: string | null): string => {
  if (!isoTime) return '--/-- ----';

  try {
    const date = new Date(isoTime);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '--/-- ----';
  }
};

/**
 * Get time difference between two UTC timestamps in Dubai timezone
 * 
 * @param startTime - Start time ISO 8601 UTC timestamp
 * @param endTime - End time ISO 8601 UTC timestamp
 * @returns Time difference as "HH:MM:SS" format
 */
export const getTimeDifference = (
  startTime: string | null,
  endTime: string | null
): string => {
  if (!startTime || !endTime) return '00:00:00';

  try {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const diffMs = end - start;

    if (diffMs < 0) return '00:00:00';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return '00:00:00';
  }
};

/**
 * Check if a time is in the morning (before noon)
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns true if time is before 12:00 PM
 */
export const isAM = (isoTime: string | null): boolean => {
  if (!isoTime) return false;

  try {
    const date = new Date(isoTime);
    return date.getHours() < 12;
  } catch (error) {
    console.error('Error checking if AM:', error);
    return false;
  }
};

/**
 * Check if a time is in the afternoon/evening (noon or later)
 *
 * @param isoTime - ISO 8601 timestamp string (stored as Dubai time)
 * @returns true if time is 12:00 PM or later
 */
export const isPM = (isoTime: string | null): boolean => {
  if (!isoTime) return false;

  try {
    const date = new Date(isoTime);
    return date.getHours() >= 12;
  } catch (error) {
    console.error('Error checking if PM:', error);
    return false;
  }
};

