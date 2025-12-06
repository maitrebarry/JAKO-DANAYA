package com.smboutique.api.service;

import com.smboutique.api.model.CommandeFournisseur;
import java.util.List;
import java.util.Optional;

public interface CommandeFournisseurService {
    List<CommandeFournisseur> findAll();
    Optional<CommandeFournisseur> findById(Long id);
    CommandeFournisseur save(CommandeFournisseur commandeFournisseur);
    void deleteById(Long id);
    List<CommandeFournisseur> findAllByBoutiqueId(Long boutiqueId);
    Optional<CommandeFournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId);
}
