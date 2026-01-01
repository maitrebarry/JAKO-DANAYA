package com.smboutique.api.service;

import com.smboutique.api.model.Utilisateur;
import java.util.List;
import java.util.Optional;

public interface UtilisateurService {
    List<Utilisateur> findAll();
    List<Utilisateur> findAllByBoutiqueId(Long boutiqueId);
    Optional<Utilisateur> findById(Long id);
    Optional<Utilisateur> findByPseudo(String pseudo);
    Optional<Utilisateur> findByEmail(String email);
    Utilisateur save(Utilisateur utilisateur);
    void deleteById(Long id);

    // Vérifie si un utilisateur possède une permission (directe ou via rôle)
    boolean hasPermission(Utilisateur utilisateur, String permissionName);
}
