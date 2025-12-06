package com.smboutique.api.service.impl;

import com.smboutique.api.model.Caisse;
import com.smboutique.api.repository.CaisseRepository;
import com.smboutique.api.service.CaisseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class CaisseServiceImpl implements CaisseService {

    @Autowired
    private CaisseRepository caisseRepository;

    @Override
    public List<Caisse> findAll() {
        return caisseRepository.findAll();
    }

    @Override
    public Optional<Caisse> findById(Long id) {
        return caisseRepository.findById(id);
    }

    @Override
    public Caisse save(Caisse caisse) {
        return caisseRepository.save(caisse);
    }

    @Override
    public void deleteById(Long id) {
        caisseRepository.deleteById(id);
    }
}
