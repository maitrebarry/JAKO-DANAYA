package com.smboutique.api.service.impl;

import com.smboutique.api.model.Depense;
import com.smboutique.api.repository.DepenseRepository;
import com.smboutique.api.service.DepenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class DepenseServiceImpl implements DepenseService {

    @Autowired
    private DepenseRepository depenseRepository;

    @Override
    public List<Depense> findAll() {
        return depenseRepository.findAll();
    }

    @Override
    public Optional<Depense> findById(Long id) {
        return depenseRepository.findById(id);
    }

    @Override
    public Optional<Depense> findByReference(String reference) { return depenseRepository.findByReference(reference); }

    @Override
    public java.util.List<Depense> findByBoutiqueId(Long boutiqueId) { return depenseRepository.findByBoutiqueIdOrderByCreatedAtDesc(boutiqueId); }

    @Override
    public java.util.List<Depense> findByStatus(com.smboutique.api.model.DepenseStatus status) { return depenseRepository.findByStatusOrderByCreatedAtDesc(status); }

    @Override
    public java.util.List<Depense> findByStatusAndBoutiqueId(com.smboutique.api.model.DepenseStatus status, Long boutiqueId) { return depenseRepository.findByStatusAndBoutiqueIdOrderByCreatedAtDesc(status, boutiqueId); }

    @Override
    public Depense save(Depense depense) {
        return depenseRepository.save(depense);
    }

    @Override
    public void deleteById(Long id) {
        depenseRepository.deleteById(id);
    }
}
