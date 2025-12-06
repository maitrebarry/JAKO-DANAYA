package com.smboutique.api.service;

import com.smboutique.api.model.ClientGrossiste;
import java.util.List;
import java.util.Optional;

public interface ClientGrossisteService {
    List<ClientGrossiste> findAll();
    Optional<ClientGrossiste> findById(Long id);
    ClientGrossiste save(ClientGrossiste clientGrossiste);
    void deleteById(Long id);
}
