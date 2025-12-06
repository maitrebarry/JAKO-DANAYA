package com.smboutique.api.service;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.repository.MagasinRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MagasinService {

    @Autowired
    private MagasinRepository magasinRepository;

    public List<Magasin> findAll() {
        return magasinRepository.findAll();
    }

    public List<Magasin> findAllByBoutiqueId(Long boutiqueId) {
        if (boutiqueId == null) {
            return List.of();
        }
        return magasinRepository.findByBoutiqueId(boutiqueId);
    }

    public Optional<Magasin> findById(Long id) {
        return magasinRepository.findById(id);
    }

    public Magasin save(Magasin magasin) {
        return magasinRepository.save(magasin);
    }

    public void deleteById(Long id) {
        magasinRepository.deleteById(id);
    }
}