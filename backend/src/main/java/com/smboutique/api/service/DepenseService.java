package com.smboutique.api.service;

import com.smboutique.api.model.Depense;
import java.util.List;
import java.util.Optional;

public interface DepenseService {
    List<Depense> findAll();
    Optional<Depense> findById(Long id);
    Depense save(Depense depense);
    void deleteById(Long id);
}
