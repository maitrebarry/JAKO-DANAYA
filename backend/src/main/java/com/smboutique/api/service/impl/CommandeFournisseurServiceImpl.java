package com.smboutique.api.service.impl;

import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.repository.CommandeFournisseurRepository;
import com.smboutique.api.service.CommandeFournisseurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class CommandeFournisseurServiceImpl implements CommandeFournisseurService {

    @Autowired
    private CommandeFournisseurRepository commandeFournisseurRepository;

    @Override
    public List<CommandeFournisseur> findAll() {
        return commandeFournisseurRepository.findAll();
    }

    @Override
    public Optional<CommandeFournisseur> findById(Long id) {
        return commandeFournisseurRepository.findById(id);
    }

    @Override
    public CommandeFournisseur save(CommandeFournisseur commandeFournisseur) {
        return commandeFournisseurRepository.save(commandeFournisseur);
    }

    @Override
    public void deleteById(Long id) {
        commandeFournisseurRepository.deleteById(id);
    }

    @Override
    public List<CommandeFournisseur> findAllByBoutiqueId(Long boutiqueId) {
        return commandeFournisseurRepository.findAllByBoutiqueId(boutiqueId);
    }

    @Override
    public Optional<CommandeFournisseur> findByIdAndBoutiqueId(Long id, Long boutiqueId) {
        return commandeFournisseurRepository.findByIdAndBoutiqueId(id, boutiqueId);
    }
}
