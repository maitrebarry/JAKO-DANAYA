package com.smboutique.api.service;

import com.smboutique.api.model.LigneReception;
import java.util.List;
import java.util.Optional;

public interface LigneReceptionService {
    List<LigneReception> findAll();
    List<LigneReception> findByReceptionId(Long receptionId);
    Optional<LigneReception> findById(Long id);
    LigneReception save(LigneReception ligneReception);
    void deleteById(Long id);
}
