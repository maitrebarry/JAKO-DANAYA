package com.smboutique.api.service;

import java.util.List;

public interface TransferModuleService {
    // high level transfer API: sourceType: BOUTIQUE|MAGASIN, destType: BOUTIQUE|MAGASIN
    void transferBetweenLocations(String sourceType, Long sourceId, String destType, Long destId, List<TransferModuleService.TransferItem> items, String username);

    class TransferItem {
        public Long produitId;
        public Integer quantite;

        public TransferItem() {}
        public TransferItem(Long produitId, Integer quantite) {
            this.produitId = produitId;
            this.quantite = quantite;
        }
    }
}
