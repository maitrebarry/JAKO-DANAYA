package com.smboutique.api.dto;

import java.util.ArrayList;
import java.util.List;

public class ImportJobStatus {
    public enum State { PENDING, RUNNING, COMPLETED, FAILED, CANCELLED }

    private String jobId;
    private String phase; // upload|parsing|validating|saving
    private int progress; // 0-100
    private State state = State.PENDING;
    private int processedCount;
    private Integer totalRows;
    private List<String> errors = new ArrayList<>();

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }
    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }
    public int getProgress() { return progress; }
    public void setProgress(int progress) { this.progress = progress; }
    public State getState() { return state; }
    public void setState(State state) { this.state = state; }
    public int getProcessedCount() { return processedCount; }
    public void setProcessedCount(int processedCount) { this.processedCount = processedCount; }
    public Integer getTotalRows() { return totalRows; }
    public void setTotalRows(Integer totalRows) { this.totalRows = totalRows; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    public void addError(String e) { this.errors.add(e); }
}
