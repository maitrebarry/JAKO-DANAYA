package com.smboutique.api.exception;

import java.util.List;

public class ImportValidationException extends RuntimeException {
    private List<String> errors;

    public ImportValidationException(List<String> errors) {
        super("Import validation failed");
        this.errors = errors;
    }

    public List<String> getErrors() { return errors; }
}
