package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneVente;
import com.smboutique.api.model.PriceMode;
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
    public List<LigneVente> findAllForDashboard(Long boutiqueId) {
        return ligneVenteRepository.findAllForDashboard(boutiqueId);
    }

    @Override
    public List<LigneVente> findByVenteId(Long venteId) {
        return ligneVenteRepository.findByVenteId(venteId);
    }

    @Override
    public LigneVente save(LigneVente ligneVente) {
        // Prevent priceMode modification after creation
        if (ligneVente.getId() != null) {
            java.util.Optional<LigneVente> existing = ligneVenteRepository.findById(ligneVente.getId());
            if (existing.isPresent()) {
                PriceMode oldMode = existing.get().getPriceMode();
                PriceMode newMode = ligneVente.getPriceMode();
                if (oldMode != null && newMode != null && !oldMode.equals(newMode)) {
                    throw new RuntimeException("priceMode cannot be modified once set");
                }
            }
        }
        return ligneVenteRepository.save(ligneVente);
    }

    @Override
    public void deleteById(Long id) {
        ligneVenteRepository.deleteById(id);
    }
}
