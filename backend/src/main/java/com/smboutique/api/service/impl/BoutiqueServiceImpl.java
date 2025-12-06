package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.repository.BoutiqueRepository;
import com.smboutique.api.service.BoutiqueService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class BoutiqueServiceImpl implements BoutiqueService {

    @Autowired
    private BoutiqueRepository boutiqueRepository;

    @Override
    public List<Boutique> findAll() {
        return boutiqueRepository.findAll();
    }

    @Override
    public Optional<Boutique> findById(Long id) {
        return boutiqueRepository.findById(id);
    }

    @Override
    public Boutique save(Boutique boutique) {
        return boutiqueRepository.save(boutique);
    }

    @Override
    public void deleteById(Long id) {
        boutiqueRepository.deleteById(id);
    }
}
