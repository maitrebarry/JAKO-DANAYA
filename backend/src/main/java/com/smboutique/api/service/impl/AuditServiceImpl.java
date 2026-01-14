package com.smboutique.api.service.impl;

import com.smboutique.api.service.AuditService;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AuditServiceImpl implements AuditService {

    private static final Path CONTROLLERS_DIR = Paths.get("src/main/java/com/smboutique/api/controller");

    @Override
    public Map<String, String> auditPhoneNormalization() {
        Map<String, String> results = new HashMap<>();
        try {
            var files = Files.list(CONTROLLERS_DIR).filter(p -> p.toString().endsWith(".java")).collect(Collectors.toList());
            for (Path p : files) {
                String content = Files.readString(p);
                boolean setsPhone = content.contains("setContact(") || content.contains("setTelephone(") || content.contains("getContact(") || content.contains("getTelephone(");
                boolean usesNormalize = content.contains("validateAndNormalize(") || content.contains("phoneService.validateAndNormalize(");
                if (setsPhone && !usesNormalize) {
                    results.put(p.getFileName().toString(), "Contains phone fields but no call to PhoneService.validateAndNormalize");
                }
            }
        } catch (IOException e) {
            results.put("error", "IOException scanning controllers: " + e.getMessage());
        }
        return results;
    }
}
