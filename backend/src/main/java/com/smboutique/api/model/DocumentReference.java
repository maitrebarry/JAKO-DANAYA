package com.smboutique.api.model;

import java.time.LocalDateTime;

/**
 * Simple DTO representing a documentable business reference (no persistence).
 */
public class DocumentReference {
    private String sourceType; // VENTE, RECEPTION, INVENTAIRE, CAISSE
    private Long sourceId;
    private String reference;
    private LocalDateTime date;
    private String previewUrl;
    private String downloadUrl;

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }

    public Long getSourceId() { return sourceId; }
    public void setSourceId(Long sourceId) { this.sourceId = sourceId; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public String getPreviewUrl() { return previewUrl; }
    public void setPreviewUrl(String previewUrl) { this.previewUrl = previewUrl; }

    public String getDownloadUrl() { return downloadUrl; }
    public void setDownloadUrl(String downloadUrl) { this.downloadUrl = downloadUrl; }
}