package com.smboutique.api.service;

import com.smboutique.api.model.CaisseTransaction;
import java.util.List;

public interface CaisseTransactionService {
    CaisseTransaction save(CaisseTransaction tx);
    List<CaisseTransaction> findByReferenceCaisse(String referenceCaisse);
    List<CaisseTransaction> findByBoutiqueId(Long boutiqueId);
}