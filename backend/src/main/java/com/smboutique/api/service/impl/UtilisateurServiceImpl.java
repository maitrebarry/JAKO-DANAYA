package com.smboutique.api.service.impl;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UtilisateurServiceImpl implements UtilisateurService {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Override
    public List<Utilisateur> findAll() {
        return utilisateurRepository.findAll();
    }

    @Override
    public List<Utilisateur> findAllByBoutiqueId(Long boutiqueId) {
        if (boutiqueId == null) {
            return List.of();
        }
        return utilisateurRepository.findByBoutiqueId(boutiqueId);
    }

    @Override
    public Optional<Utilisateur> findById(Long id) {
        return utilisateurRepository.findById(id);
    }

    @Override
    public Optional<Utilisateur> findByPseudo(String pseudo) {
        return utilisateurRepository.findByPseudo(pseudo);
    }

    @Override
    public Optional<Utilisateur> findByEmail(String email) {
        return utilisateurRepository.findByEmailIgnoreCase(email == null ? null : email.trim());
    }

    @Override
    public Utilisateur save(Utilisateur utilisateur) {
        return utilisateurRepository.save(utilisateur);
    }

    @Override
    public void deleteById(Long id) {
        utilisateurRepository.deleteById(id);
    }
}
