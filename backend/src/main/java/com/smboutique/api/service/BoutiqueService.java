package com.smboutique.api.service;

import com.smboutique.api.model.Boutique;
import java.util.List;
import java.util.Optional;

public interface BoutiqueService {
    List<Boutique> findAll();
    Optional<Boutique> findById(Long id);
    Boutique save(Boutique boutique);
    void deleteById(Long id);
}
