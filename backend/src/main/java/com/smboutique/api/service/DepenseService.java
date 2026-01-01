package com.smboutique.api.service;

import com.smboutique.api.model.Depense;
import java.util.List;
import java.util.Optional;

public interface DepenseService {
    List<Depense> findAll();
    Optional<Depense> findById(Long id);
    Optional<Depense> findByReference(String reference);
    List<Depense> findByBoutiqueId(Long boutiqueId);
    List<Depense> findByStatus(com.smboutique.api.model.DepenseStatus status);
    List<Depense> findByStatusAndBoutiqueId(com.smboutique.api.model.DepenseStatus status, Long boutiqueId);
    Depense save(Depense depense);
    void deleteById(Long id);
}
