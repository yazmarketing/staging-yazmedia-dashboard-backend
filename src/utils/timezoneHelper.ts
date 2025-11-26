/**
 * Country to IANA Timezone Mapping
 * Maps country names to their primary IANA timezone identifiers
 */
export const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  // UAE / Dubai
  'UAE': 'Asia/Dubai',
  'United Arab Emirates': 'Asia/Dubai',
  'Dubai': 'Asia/Dubai',
  
  // Egypt
  'Egypt': 'Africa/Cairo',
  'EGY': 'Africa/Cairo',
  
  // Saudi Arabia
  'Saudi Arabia': 'Asia/Riyadh',
  'KSA': 'Asia/Riyadh',
  
  // Other Middle East
  'Jordan': 'Asia/Amman',
  'Lebanon': 'Asia/Beirut',
  'Kuwait': 'Asia/Kuwait',
  'Qatar': 'Asia/Qatar',
  'Bahrain': 'Asia/Bahrain',
  'Oman': 'Asia/Muscat',
  'Iraq': 'Asia/Baghdad',
  'Syria': 'Asia/Damascus',
  'Yemen': 'Asia/Aden',
  'Palestine': 'Asia/Gaza',
  'Israel': 'Asia/Jerusalem',
  
  // Europe
  'United Kingdom': 'Europe/London',
  'UK': 'Europe/London',
  'Germany': 'Europe/Berlin',
  'France': 'Europe/Paris',
  'Italy': 'Europe/Rome',
  'Spain': 'Europe/Madrid',
  'Netherlands': 'Europe/Amsterdam',
  'Belgium': 'Europe/Brussels',
  'Switzerland': 'Europe/Zurich',
  'Austria': 'Europe/Vienna',
  'Poland': 'Europe/Warsaw',
  'Portugal': 'Europe/Lisbon',
  'Greece': 'Europe/Athens',
  'Turkey': 'Europe/Istanbul',
  
  // Americas
  'United States': 'America/New_York',
  'USA': 'America/New_York',
  'US': 'America/New_York',
  'Canada': 'America/Toronto',
  'Mexico': 'America/Mexico_City',
  'Brazil': 'America/Sao_Paulo',
  'Argentina': 'America/Argentina/Buenos_Aires',
  
  // Asia
  'India': 'Asia/Kolkata',
  'Pakistan': 'Asia/Karachi',
  'Bangladesh': 'Asia/Dhaka',
  'Sri Lanka': 'Asia/Colombo',
  'Nepal': 'Asia/Kathmandu',
  'China': 'Asia/Shanghai',
  'Japan': 'Asia/Tokyo',
  'South Korea': 'Asia/Seoul',
  'Singapore': 'Asia/Singapore',
  'Malaysia': 'Asia/Kuala_Lumpur',
  'Thailand': 'Asia/Bangkok',
  'Philippines': 'Asia/Manila',
  'Indonesia': 'Asia/Jakarta',
  'Vietnam': 'Asia/Ho_Chi_Minh',
  
  // Africa
  'South Africa': 'Africa/Johannesburg',
  'Kenya': 'Africa/Nairobi',
  'Nigeria': 'Africa/Lagos',
  'Morocco': 'Africa/Casablanca',
  'Tunisia': 'Africa/Tunis',
  'Algeria': 'Africa/Algiers',
  
  // Oceania
  'Australia': 'Australia/Sydney',
  'New Zealand': 'Pacific/Auckland',
};

/**
 * Get timezone for a country
 * @param country Country name (case-insensitive)
 * @returns IANA timezone identifier, defaults to "Asia/Dubai"
 */
export const getTimezoneForCountry = (country: string | null | undefined): string => {
  if (!country) return 'Asia/Dubai';
  
  // Try exact match first
  const exactMatch = COUNTRY_TO_TIMEZONE[country];
  if (exactMatch) return exactMatch;
  
  // Try case-insensitive match
  const countryUpper = country.toUpperCase();
  for (const [key, timezone] of Object.entries(COUNTRY_TO_TIMEZONE)) {
    if (key.toUpperCase() === countryUpper) {
      return timezone;
    }
  }
  
  // Default to Dubai
  return 'Asia/Dubai';
};

/**
 * Get employee timezone
 * @param employee Employee object with country and/or timezone
 * @returns IANA timezone identifier
 */
export const getEmployeeTimezone = (employee: { 
  country?: string | null;
  timezone?: string | null;
}): string => {
  // If timezone is explicitly set, use it
  if (employee.timezone) {
    return employee.timezone;
  }
  
  // Otherwise, derive from country
  return getTimezoneForCountry(employee.country);
};

/**
 * Get working hours for an employee
 * Defaults to 9 AM - 6 PM in their timezone
 */
export const getEmployeeWorkingHours = (employee: { 
  country?: string | null;
  timezone?: string | null;
  workingHoursStart?: number | null;
  workingHoursEnd?: number | null;
}) => {
  const tz = getEmployeeTimezone(employee);
  const start = employee.workingHoursStart ?? 9; // 9 AM
  const end = employee.workingHoursEnd ?? 18; // 6 PM
  return { timezone: tz, start, end };
};


