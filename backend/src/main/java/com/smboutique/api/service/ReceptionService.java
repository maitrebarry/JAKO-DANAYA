package com.smboutique.api.service;

import com.smboutique.api.model.Reception;
import java.util.List;
import java.util.Optional;

public interface ReceptionService {
    List<Reception> findAll();
    Optional<Reception> findById(Long id);
    Reception save(Reception reception);
    void deleteById(Long id);
}
