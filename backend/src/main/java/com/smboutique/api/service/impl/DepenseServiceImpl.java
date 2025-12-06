package com.smboutique.api.service.impl;

import com.smboutique.api.model.Depense;
import com.smboutique.api.repository.DepenseRepository;
import com.smboutique.api.service.DepenseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class DepenseServiceImpl implements DepenseService {

    @Autowired
    private DepenseRepository depenseRepository;

    @Override
    public List<Depense> findAll() {
        return depenseRepository.findAll();
    }

    @Override
    public Optional<Depense> findById(Long id) {
        return depenseRepository.findById(id);
    }

    @Override
    public Depense save(Depense depense) {
        return depenseRepository.save(depense);
    }

    @Override
    public void deleteById(Long id) {
        depenseRepository.deleteById(id);
    }
}
