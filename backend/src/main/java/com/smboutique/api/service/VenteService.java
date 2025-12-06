package com.smboutique.api.service;

import com.smboutique.api.model.Vente;
import java.util.List;
import java.util.Optional;

public interface VenteService {
    List<Vente> findAll();
    Optional<Vente> findById(Long id);
    Vente save(Vente vente);
    void deleteById(Long id);
}
