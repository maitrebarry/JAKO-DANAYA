package com.smboutique.api.service.impl;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.repository.MouvementRepository;
import com.smboutique.api.service.MouvementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class MouvementServiceImpl implements MouvementService {

    @Autowired
    private MouvementRepository mouvementRepository;

    @Override
    public List<Mouvement> findAll() {
        return mouvementRepository.findAll();
    }

    @Override
    public Optional<Mouvement> findById(Long id) {
        return mouvementRepository.findById(id);
    }

    @Override
    public Mouvement save(Mouvement mouvement) {
        return mouvementRepository.save(mouvement);
    }

    @Override
    public void deleteById(Long id) {
        mouvementRepository.deleteById(id);
    }
}
