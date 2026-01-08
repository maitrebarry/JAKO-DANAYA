package com.smboutique.api.service.impl;

import org.springframework.stereotype.Component;

/**
 * Legacy placeholder: DocumentServiceImpl removed because documents are generated on demand.
 * This component intentionally throws UnsupportedOperationException if invoked.
 */
@Component
public class DocumentServiceImpl {
    public DocumentServiceImpl() { }

    public void unsupported() {
        throw new UnsupportedOperationException("DocumentService is deprecated. Use document generation endpoints instead.");
    }
}