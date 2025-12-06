package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneVente;
import com.smboutique.api.repository.LigneVenteRepository;
import com.smboutique.api.service.LigneVenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneVenteServiceImpl implements LigneVenteService {

    @Autowired
    private LigneVenteRepository ligneVenteRepository;

    @Override
    public List<LigneVente> findAll() {
        return ligneVenteRepository.findAll();
    }

    @Override
    public Optional<LigneVente> findById(Long id) {
        return ligneVenteRepository.findById(id);
    }

    @Override
    public LigneVente save(LigneVente ligneVente) {
        return ligneVenteRepository.save(ligneVente);
    }

    @Override
    public void deleteById(Long id) {
        ligneVenteRepository.deleteById(id);
    }
}
