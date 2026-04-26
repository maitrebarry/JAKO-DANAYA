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
        } else if (cfg.getTypeMarge() == ConfigurationMarge.TypeMarge.POURCENTAGE) {
            // POURCENTAGE
            BigDecimal compG = prixAchat.multiply(valG).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            BigDecimal compD = prixAchat.multiply(valD).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP);
            margG = compG.max(minG);
            margD = compD.max(minD);
            prixGrosBD = prixAchat.add(margG);
            prixDetailBD = prixAchat.add(margD);
        } else {
            // MANUEL: if the user provided prices, accept them and compute margins from them
            // Do not overwrite user-provided prices; just compute and store the corresponding margins.
            if (p.getPrixEnGros() != null) {
                prixGrosBD = BigDecimal.valueOf(p.getPrixEnGros());
                margG = prixGrosBD.subtract(prixAchat);
            } else {
                prixGrosBD = null;
                margG = null;
            }

            if (p.getPrixDetail() != null) {
                prixDetailBD = BigDecimal.valueOf(p.getPrixDetail());
                margD = prixDetailBD.subtract(prixAchat);
            } else {
                prixDetailBD = null;
                margD = null;
            }
        }

        if (prixGrosBD != null) {
            p.setPrixEnGros(prixGrosBD.setScale(0, RoundingMode.HALF_UP).intValue());
        }

        if (prixDetailBD != null) {
            p.setPrixDetail(prixDetailBD.setScale(0, RoundingMode.HALF_UP).intValue());
        }

        p.setMargeGros(margG);
        p.setMargeDetail(margD);
    }
}
