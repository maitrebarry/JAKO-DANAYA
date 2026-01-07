package com.smboutique.api.util;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class DateUtils {
    public static final ZoneId DAKAR = ZoneId.of("Africa/Dakar");
    private static final DateTimeFormatter DISPLAY_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    public static String formatToDakar(LocalDateTime dt) {
        if (dt == null) return null;
        // Interpret stored LocalDateTime as server/system local time and convert to Africa/Dakar instant
        java.time.ZonedDateTime z = dt.atZone(java.time.ZoneId.systemDefault()).withZoneSameInstant(DAKAR);
        return z.format(DISPLAY_FMT);
    }

    public static String toIsoOffset(LocalDateTime dt) {
        if (dt == null) return null;
        java.time.ZonedDateTime z = dt.atZone(java.time.ZoneId.systemDefault()).withZoneSameInstant(DAKAR);
        return z.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }
}
