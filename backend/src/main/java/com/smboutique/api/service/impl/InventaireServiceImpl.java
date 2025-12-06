package com.smboutique.api.service.impl;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.repository.InventaireRepository;
import com.smboutique.api.service.InventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class InventaireServiceImpl implements InventaireService {

    @Autowired
    private InventaireRepository inventaireRepository;

    @Override
    public List<Inventaire> findAll() {
        return inventaireRepository.findAll();
    }

    @Override
    public Optional<Inventaire> findById(Long id) {
        return inventaireRepository.findById(id);
    }

    @Override
    public Inventaire save(Inventaire inventaire) {
        return inventaireRepository.save(inventaire);
    }

    @Override
    public void deleteById(Long id) {
        inventaireRepository.deleteById(id);
    }
}
