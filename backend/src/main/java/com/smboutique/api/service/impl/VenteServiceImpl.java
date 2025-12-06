package com.smboutique.api.service.impl;

import com.smboutique.api.model.Vente;
import com.smboutique.api.repository.VenteRepository;
import com.smboutique.api.service.VenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class VenteServiceImpl implements VenteService {

    @Autowired
    private VenteRepository venteRepository;

    @Override
    public List<Vente> findAll() {
        return venteRepository.findAll();
    }

    @Override
    public Optional<Vente> findById(Long id) {
        return venteRepository.findById(id);
    }

    @Override
    public Vente save(Vente vente) {
        return venteRepository.save(vente);
    }

    @Override
    public void deleteById(Long id) {
        venteRepository.deleteById(id);
    }
}
