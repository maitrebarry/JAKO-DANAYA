package com.smboutique.api.service;

public interface PhoneService {
    /**
     * Validate and normalize telephone given a country code (ISO). Returns normalized telephone (e.g., +22312345678) or throws IllegalArgumentException on invalid input.
     */
    String validateAndNormalize(String telephone, String codePays);
}