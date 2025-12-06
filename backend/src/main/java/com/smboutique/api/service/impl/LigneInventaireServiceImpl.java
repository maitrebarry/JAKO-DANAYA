package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneInventaire;
import com.smboutique.api.repository.LigneInventaireRepository;
import com.smboutique.api.service.LigneInventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneInventaireServiceImpl implements LigneInventaireService {

    @Autowired
    private LigneInventaireRepository ligneInventaireRepository;

    @Override
    public List<LigneInventaire> findAll() {
        return ligneInventaireRepository.findAll();
    }

    @Override
    public Optional<LigneInventaire> findById(Long id) {
        return ligneInventaireRepository.findById(id);
    }

    @Override
    public LigneInventaire save(LigneInventaire ligneInventaire) {
        return ligneInventaireRepository.save(ligneInventaire);
    }

    @Override
    public void deleteById(Long id) {
        ligneInventaireRepository.deleteById(id);
    }
}
