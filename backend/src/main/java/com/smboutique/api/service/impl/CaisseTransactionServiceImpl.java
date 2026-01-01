package com.smboutique.api.service.impl;

import com.smboutique.api.model.CaisseTransaction;
import com.smboutique.api.repository.CaisseTransactionRepository;
import com.smboutique.api.service.CaisseTransactionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CaisseTransactionServiceImpl implements CaisseTransactionService {

    @Autowired
    private CaisseTransactionRepository repository;

    @Override
    public CaisseTransaction save(CaisseTransaction tx) {
        return repository.save(tx);
    }

    @Override
    public List<CaisseTransaction> findByReferenceCaisse(String referenceCaisse) {
        return repository.findByReferenceCaisse(referenceCaisse);
    }

    @Override
    public List<CaisseTransaction> findByBoutiqueId(Long boutiqueId) {
        return repository.findByBoutiqueId(boutiqueId);
    }
}