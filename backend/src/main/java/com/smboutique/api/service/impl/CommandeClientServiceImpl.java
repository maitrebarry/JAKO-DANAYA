package com.smboutique.api.service.impl;

import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.repository.CommandeClientRepository;
import com.smboutique.api.service.CommandeClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class CommandeClientServiceImpl implements CommandeClientService {

    @Autowired
    private CommandeClientRepository commandeClientRepository;

    @Override
    public List<CommandeClient> findAll() {
        return commandeClientRepository.findAll();
    }

    @Override
    public Optional<CommandeClient> findById(Long id) {
        return commandeClientRepository.findById(id);
    }

    @Override
    public CommandeClient save(CommandeClient commandeClient) {
        return commandeClientRepository.save(commandeClient);
    }

    @Override
    public void deleteById(Long id) {
        commandeClientRepository.deleteById(id);
    }
}
