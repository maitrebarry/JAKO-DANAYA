// Utilities to format and parse server date strings without introducing timezone shifts

// Format a server-sent timestamp (SQL or ISO) into a human-friendly French string
export const formatServerDate = (d?: string | null): string => {
  if (!d) return '';
  // If already in display format dd/MM/yyyy return as-is
  if (d.includes('/')) return d;

  // Handle SQL/ISO timestamps with optional microseconds and optional timezone
  // Examples accepted:
  // 2025-12-26 22:27:14.000000
  // 2025-12-26T22:27:14Z
  // 2025-12-26T22:27:14+01:00
  // 2025-12-26 22:27:14
  const tsMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:?\d{2})|Z)?$/);
  if (tsMatch) {
    const [, y, m, day, hh, mm, ss, offset] = tsMatch;
    // If an explicit timezone (offset or Z) is present, parse as an instant and display in client's local timezone
    if (offset || d.endsWith('Z')) {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return `${day}/${m}/${y} ${hh}:${mm}:${ss}`;
      return dt.toLocaleString('fr-FR');
    }
    // No timezone provided: treat as server-local timestamp and return literal server time
    return `${day}/${m}/${y} ${hh}:${mm}:${ss}`;
  }

  // Handle ISO without seconds: 2025-12-26T22:27
  const isoShort = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (isoShort) {
    const [, y, m, day, hh, mm] = isoShort;
    return `${day}/${m}/${y} ${hh}:${mm}:00`;
  }

  // Last resort: let Date format in fr-FR but it may shift the hour
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleString('fr-FR');
};

// Format a value as a localized client-side date (convert to local timezone)
export const formatLocalDate = (d?: string | Date | null): string => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString('fr-FR');
};

// Convert a server timestamp into a datetime-local input value (YYYY-MM-DDTHH:MM)
export const toDatetimeLocalInput = (d?: string | null): string => {
  if (!d) return '';
  // Prefer parsing without timezone adjustments
  const tsMatch = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:([+-]\d{2}:?\d{2})|Z)?$/);
  if (tsMatch) {
    const [, y, m, day, hh, mm] = tsMatch;
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  const isoShort = d.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (isoShort) {
    const [, y, m, day, hh, mm] = isoShort;
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
  // Fallback to Date, may shift timezone
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 16);
};
