package com.smboutique.api.service;

import java.util.Map;

public interface AuditService {
    /**
     * Scan controller source files for phone normalization usage and return a report map: {filename -> issue description}
     */
    Map<String, String> auditPhoneNormalization();
}
