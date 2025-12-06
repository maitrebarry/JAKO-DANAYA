package com.smboutique.api.service.impl;

import com.smboutique.api.model.LigneReception;
import com.smboutique.api.repository.LigneReceptionRepository;
import com.smboutique.api.service.LigneReceptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LigneReceptionServiceImpl implements LigneReceptionService {

    @Autowired
    private LigneReceptionRepository ligneReceptionRepository;

    @Override
    public List<LigneReception> findAll() {
        return ligneReceptionRepository.findAll();
    }

    @Override
    public Optional<LigneReception> findById(Long id) {
        return ligneReceptionRepository.findById(id);
    }

    @Override
    public LigneReception save(LigneReception ligneReception) {
        return ligneReceptionRepository.save(ligneReception);
    }

    @Override
    public void deleteById(Long id) {
        ligneReceptionRepository.deleteById(id);
    }
}
