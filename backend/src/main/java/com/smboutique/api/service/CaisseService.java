package com.smboutique.api.service;

import com.smboutique.api.model.Caisse;
import java.util.List;
import java.util.Optional;

public interface CaisseService {
    List<Caisse> findAll();
    Optional<Caisse> findById(Long id);
    Caisse save(Caisse caisse);
    void deleteById(Long id);
}
