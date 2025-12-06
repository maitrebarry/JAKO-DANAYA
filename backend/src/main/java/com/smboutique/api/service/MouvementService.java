package com.smboutique.api.service;

import com.smboutique.api.model.Mouvement;
import java.util.List;
import java.util.Optional;

public interface MouvementService {
    List<Mouvement> findAll();
    Optional<Mouvement> findById(Long id);
    Mouvement save(Mouvement mouvement);
    void deleteById(Long id);
}
