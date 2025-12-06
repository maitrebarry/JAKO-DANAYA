package com.smboutique.api.service.impl;

import com.smboutique.api.model.Unite;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.service.UniteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UniteServiceImpl implements UniteService {

    @Autowired
    private UniteRepository uniteRepository;

    @Override
    public List<Unite> findAll() {
        return uniteRepository.findAll();
    }

    @Override
    public List<Unite> findAllByBoutiqueId(Long boutiqueId) {
        return uniteRepository.findAllByBoutiqueId(boutiqueId);
    }

    @Override
    public Optional<Unite> findById(Long id) {
        return uniteRepository.findById(id);
    }

    @Override
    public Optional<Unite> findByIdAndBoutiqueId(Long id, Long boutiqueId) {
        return uniteRepository.findByIdAndBoutiqueId(id, boutiqueId);
    }

    @Override
    public Unite save(Unite unite) {
        return uniteRepository.save(unite);
    }

    @Override
    public void deleteById(Long id) {
        uniteRepository.deleteById(id);
    }
}
