package com.smboutique.api.service.impl;

import com.smboutique.api.model.ConfigurationMarge;
import com.smboutique.api.model.Produit;
import com.smboutique.api.service.ConfigurationMargeService;
import com.smboutique.api.service.ProduitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

@Service
public class MarginRecomputeService {

    @Autowired
    private ConfigurationMargeService configurationMargeService;

    @Autowired
    private ProduitService produitService;

    public int recomputeForBoutique(Long boutiqueId) {
        if (boutiqueId == null) return 0;
        Optional<ConfigurationMarge> cfgOpt = configurationMargeService.findByBoutiqueId(boutiqueId);
        ConfigurationMarge cfg = cfgOpt.orElse(null);
        List<Produit> produits = produitService.findByBoutiqueId(boutiqueId);
        int updated = 0;
        for (Produit p : produits) {
            try {
                if (p.getPrixAchat() == null) continue;
                MargeCalculator.apply(cfg, p);
                produitService.save(p);
                updated++;
            } catch (Exception ex) {
                org.slf4j.LoggerFactory.getLogger(MarginRecomputeService.class).warn("Failed to recompute product {}: {}", p.getId(), ex.getMessage());
            }
        }
        org.slf4j.LoggerFactory.getLogger(MarginRecomputeService.class).info("Recomputed margins for boutique {}: productsUpdated={}", boutiqueId, updated);
        return updated;
    }

    @Async
    public CompletableFuture<Integer> recomputeForBoutiqueAsync(Long boutiqueId) {
        int updated = recomputeForBoutique(boutiqueId);
        return CompletableFuture.completedFuture(updated);
    }
}
