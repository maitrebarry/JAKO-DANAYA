package com.smboutique.api.service;

import com.smboutique.api.model.UtilisationPertes;
import java.util.List;
import java.util.Optional;

public interface UtilisationPertesService {
    List<UtilisationPertes> findAll();
    Optional<UtilisationPertes> findById(Long id);
    UtilisationPertes save(UtilisationPertes utilisationPertes);
    void deleteById(Long id);
}
