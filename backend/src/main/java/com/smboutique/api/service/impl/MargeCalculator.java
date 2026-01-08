package com.smboutique.api.service.impl;

import com.smboutique.api.model.ConfigurationMarge;
import com.smboutique.api.model.Produit;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Utility to compute and apply margins/prices to Produit using ConfigurationMarge.
 */
public final class MargeCalculator {

    private MargeCalculator() {}

    public static void apply(ConfigurationMarge cfg, Produit p) {
        if (cfg == null || p == null || p.getPrixAchat() == null) return;
        BigDecimal prixAchat = BigDecimal.valueOf(p.getPrixAchat());

        BigDecimal valG = cfg.getValeurGros() != null ? cfg.getValeurGros() : BigDecimal.ZERO;
        BigDecimal valD = cfg.getValeurDetail() != null ? cfg.getValeurDetail() : BigDecimal.ZERO;
        BigDecimal minG = cfg.getMargeMinimaleGros() != null ? cfg.getMargeMinimaleGros() : BigDecimal.ZERO;
        BigDecimal minD = cfg.getMargeMinimaleDetail() != null ? cfg.getMargeMinimaleDetail() : BigDecimal.ZERO;

        BigDecimal margG;
        BigDecimal margD;
        BigDecimal prixGrosBD;
        BigDecimal prixDetailBD;

        if (cfg.getTypeMarge() == ConfigurationMarge.TypeMarge.FIXE) {
            margG = valG.max(minG);
            margD = valD.max(minD);
            prixGrosBD = prixAchat.add(margG);
            prixDetailBD = prixAchat.add(margD);
        } else {
            // POURCENTAGE
            BigDecimal compG = prixAchat.multiply(valG).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            BigDecimal compD = prixAchat.multiply(valD).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            margG = compG.max(minG);
            margD = compD.max(minD);
            prixGrosBD = prixAchat.add(margG);
            prixDetailBD = prixAchat.add(margD);
        }

        p.setPrixEnGros(prixGrosBD.setScale(0, RoundingMode.HALF_UP).intValue());
        p.setPrixDetail(prixDetailBD.setScale(0, RoundingMode.HALF_UP).intValue());
        p.setMargeGros(margG);
        p.setMargeDetail(margD);
    }
}
