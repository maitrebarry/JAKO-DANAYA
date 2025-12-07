package com.smboutique.api.dto;

import java.util.List;

public class ImportResult {
    private int processedCount;
    private List<String> errors;

    public ImportResult(int processedCount, List<String> errors) {
        this.processedCount = processedCount;
        this.errors = errors;
    }

    public int getProcessedCount() { return processedCount; }
    public void setProcessedCount(int processedCount) { this.processedCount = processedCount; }

    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
}
