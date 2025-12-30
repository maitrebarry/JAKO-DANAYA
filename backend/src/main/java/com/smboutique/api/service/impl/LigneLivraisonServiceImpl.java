package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneLivraison;
import com.smboutique.api.repository.LigneLivraisonRepository;
import com.smboutique.api.service.LigneLivraisonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneLivraisonServiceImpl implements LigneLivraisonService {

    @Autowired
    private LigneLivraisonRepository ligneLivraisonRepository;

    @Override
    public List<LigneLivraison> findAll() {
        return ligneLivraisonRepository.findAll();
    }

    @Override
    public Optional<LigneLivraison> findById(Long id) {
        return ligneLivraisonRepository.findById(id);
    }

    @Override
    public LigneLivraison save(LigneLivraison ligneLivraison) {
        return ligneLivraisonRepository.save(ligneLivraison);
    }

    @Override
    public void deleteById(Long id) {
        ligneLivraisonRepository.deleteById(id);
    }

    @Override
    public List<LigneLivraison> findByLivraisonId(Long livraisonId) {
        return ligneLivraisonRepository.findByLivraisonId(livraisonId);
    }
}
