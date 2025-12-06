package com.smboutique.api.service.impl;

import com.smboutique.api.model.ClientGrossiste;
import com.smboutique.api.repository.ClientGrossisteRepository;
import com.smboutique.api.service.ClientGrossisteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ClientGrossisteServiceImpl implements ClientGrossisteService {

    @Autowired
    private ClientGrossisteRepository clientGrossisteRepository;

    @Override
    public List<ClientGrossiste> findAll() {
        return clientGrossisteRepository.findAll();
    }

    @Override
    public Optional<ClientGrossiste> findById(Long id) {
        return clientGrossisteRepository.findById(id);
    }

    @Override
    public ClientGrossiste save(ClientGrossiste clientGrossiste) {
        return clientGrossisteRepository.save(clientGrossiste);
    }

    @Override
    public void deleteById(Long id) {
        clientGrossisteRepository.deleteById(id);
    }
}
