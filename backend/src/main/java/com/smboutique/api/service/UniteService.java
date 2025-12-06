package com.smboutique.api.service;

import com.smboutique.api.model.Unite;
import java.util.List;
import java.util.Optional;

public interface UniteService {
    List<Unite> findAll();
    List<Unite> findAllByBoutiqueId(Long boutiqueId);
    Optional<Unite> findById(Long id);
    Optional<Unite> findByIdAndBoutiqueId(Long id, Long boutiqueId);
    Unite save(Unite unite);
    void deleteById(Long id);
}
