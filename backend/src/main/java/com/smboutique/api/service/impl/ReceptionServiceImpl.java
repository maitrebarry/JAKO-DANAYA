package com.smboutique.api.service.impl;

import com.smboutique.api.model.Reception;
import com.smboutique.api.repository.ReceptionRepository;
import com.smboutique.api.service.ReceptionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ReceptionServiceImpl implements ReceptionService {

    @Autowired
    private ReceptionRepository receptionRepository;

    @Override
    public List<Reception> findAll() {
        return receptionRepository.findAll();
    }

    @Override
    public Optional<Reception> findById(Long id) {
        return receptionRepository.findById(id);
    }

    @Override
    public Reception save(Reception reception) {
        return receptionRepository.save(reception);
    }

    @Override
    public void deleteById(Long id) {
        receptionRepository.deleteById(id);
    }
}
