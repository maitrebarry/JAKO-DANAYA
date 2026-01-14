package com.smboutique.api.service.impl;

import com.smboutique.api.model.Pays;
import com.smboutique.api.repository.PaysRepository;
import com.smboutique.api.service.PhoneService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class PhoneServiceImpl implements PhoneService {

    @Autowired
    private PaysRepository paysRepository;

    private String clean(String s) {
        if (s == null) return null;
        return s.replaceAll("[\\s()\\-]", "");
    }

    @Override
    public String validateAndNormalize(String telephone, String codePays) {
        if (telephone == null || telephone.isEmpty()) {
            throw new IllegalArgumentException("Téléphone manquant");
        }
        if (codePays == null || codePays.isEmpty()) {
            throw new IllegalArgumentException("code_pays manquant");
        }
        String t = clean(telephone);
        String code = codePays.toUpperCase();
        Pays p = paysRepository.findByCodeIso(code).orElseThrow(() -> new IllegalArgumentException("Pays inconnu: " + code));
        String indic = clean(p.getIndicatif());
        if (!indic.startsWith("+")) indic = "+" + indic;

        // If the provided number does not start with + (international), treat it as a national number and prepend the country's indicatif
        if (!t.startsWith("+")) {
            // remove leading zeros which some users might enter
            t = t.replaceFirst("^0+", "");
            t = indic + t;
        }

        // Final normalized form must start with the country's indicatif
        if (!t.startsWith(indic)) {
            throw new IllegalArgumentException("Indicatif incorrect pour le pays " + code + " (attendu: " + indic + ")");
        }

        // Ensure leading + (should already be present on indic)
        if (!t.startsWith("+")) {
            t = "+" + t;
        }

        return t;
    }
}