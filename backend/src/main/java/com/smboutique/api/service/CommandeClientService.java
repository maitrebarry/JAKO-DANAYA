package com.smboutique.api.service;

import com.smboutique.api.model.CommandeClient;
import java.util.List;
import java.util.Optional;

public interface CommandeClientService {
    List<CommandeClient> findAll();
    Optional<CommandeClient> findById(Long id);
    CommandeClient save(CommandeClient commandeClient);
    void deleteById(Long id);
}
