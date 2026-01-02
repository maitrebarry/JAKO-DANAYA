package com.smboutique.api.service;

public interface TransferService {
    void transfer(Long sourceStockId, Long destStockId, Integer quantite);
}
