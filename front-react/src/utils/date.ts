// Utilities to format and parse server date strings without introducing timezone shifts

const DAKAR_TZ = 'Africa/Dakar';

function partsFor(date: Date, timeZone = DAKAR_TZ) {
  const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const parts = fmt.formatToParts(date);
  const map: any = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return map;
}

function formatPartsToDisplay(map: any) {
  return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute}:${map.second}`;
}

// Format a server-sent timestamp (SQL or ISO) into a human-friendly French string in Africa/Dakar
export const formatServerDate = (d?: string | null): string => {
  if (!d) return '';
  // If already in display format dd/MM/yyyy return as-is
  if (d.includes('/')) return d;

  // Handle SQL/ISO timestamps with optional microseconds and optional timezone
  const tsMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:?\d{2})|Z)?$/);
  if (tsMatch) {
    const [, y, m, day, hh, mm, , offset] = tsMatch;
    // If an explicit timezone (offset or Z) is present, parse as an instant and display in Africa/Dakar
    if (offset || d.endsWith('Z')) {
      const iso = d.includes('T') ? d : d.replace(' ', 'T');
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return `${day}/${m}/${y} ${hh}:${mm}:00`;
      const map = partsFor(dt, DAKAR_TZ);
      return formatPartsToDisplay(map as any);
    }
    // No timezone provided: treat as server-local timestamp (assume server in Africa/Dakar) and return literal server time
    return `${day}/${m}/${y} ${hh}:${mm}:00`;
  }

  // Handle ISO without seconds: 2025-12-26T22:27
  const isoShort = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (isoShort) {
    const [, y, m, day, hh, mm] = isoShort;
    return `${day}/${m}/${y} ${hh}:${mm}:00`;
  }

  // Last resort: let Date format in Africa/Dakar
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const map = partsFor(dt, DAKAR_TZ);
  return formatPartsToDisplay(map as any);
};

// Format a value as a localized date in Africa/Dakar
export const formatLocalDate = (d?: string | Date | null): string => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const map = partsFor(dt, DAKAR_TZ);
  return formatPartsToDisplay(map as any);
};

// Convert a server timestamp into a datetime-local input value (YYYY-MM-DDTHH:MM) in Africa/Dakar
export const toDatetimeLocalInput = (d?: string | null): string => {
  if (!d) return '';
  const tsMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:?\d{2})|Z)?$/);
  if (tsMatch) {
    const [, y, m, day, hh, mm, , offset] = tsMatch;
    // If an explicit timezone is present, convert to Africa/Dakar local time for datetime-local
    if (offset || d.endsWith('Z')) {
      const iso = d.includes('T') ? d : d.replace(' ', 'T');
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return `${y}-${m}-${day}T${hh}:${mm}`;
      const map = partsFor(dt, DAKAR_TZ);
      return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
    }
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  const isoShort = d.match(/^([\d]{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (isoShort) {
    const [, y, m, day, hh, mm] = isoShort;
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  // Fallback to Date in Africa/Dakar
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  const map = partsFor(dt, DAKAR_TZ);
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
};
