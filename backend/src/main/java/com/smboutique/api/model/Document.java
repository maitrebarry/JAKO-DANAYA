package com.smboutique.api.model;

import java.time.Instant;

/**
 * Deprecated: there is no persisted Document entity. Use generated document references instead.
 * This lightweight POJO remains for compatibility with older code paths and should NOT be persisted.
 */
@Deprecated
public class Document {
    private Long id;
    private String type;
    private String reference;
    private Long boutiqueId;
    private Long createdBy;
    private Instant createdAt;
    private String path;
    private String metadata;

    public Document() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public Long getBoutiqueId() { return boutiqueId; }
    public void setBoutiqueId(Long boutiqueId) { this.boutiqueId = boutiqueId; }

    public Long getCreatedBy() { return createdBy; }
    public void setCreatedBy(Long createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
}