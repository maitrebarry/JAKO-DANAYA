package com.smboutique.api.service.impl;

import com.smboutique.api.model.UtilisationPertes;
import com.smboutique.api.repository.UtilisationPertesRepository;
import com.smboutique.api.service.UtilisationPertesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UtilisationPertesServiceImpl implements UtilisationPertesService {

    @Autowired
    private UtilisationPertesRepository utilisationPertesRepository;

    @Override
    public List<UtilisationPertes> findAll() {
        return utilisationPertesRepository.findAll();
    }

    @Override
    public Optional<UtilisationPertes> findById(Long id) {
        return utilisationPertesRepository.findById(id);
    }

    @Override
    public UtilisationPertes save(UtilisationPertes utilisationPertes) {
        return utilisationPertesRepository.save(utilisationPertes);
    }

    @Override
    public void deleteById(Long id) {
        utilisationPertesRepository.deleteById(id);
    }
}
