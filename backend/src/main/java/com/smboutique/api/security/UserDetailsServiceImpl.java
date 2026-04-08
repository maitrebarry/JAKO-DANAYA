package com.smboutique.api.security;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        String id = email == null ? null : email.trim();
        if (id == null || id.isEmpty()) {
            throw new UsernameNotFoundException("Email manquant");
        }

        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(id)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur non trouvé avec l'email: " + id));

        Set<GrantedAuthority> authorities = new HashSet<>();

        // Ajouter les permissions des rôles
        if (utilisateur.getRoles() != null) {
            for (Role role : utilisateur.getRoles()) {
                authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName()));
                if (role.getPermissions() != null) {
                    for (Permission permission : role.getPermissions()) {
                        authorities.add(new SimpleGrantedAuthority(permission.getName()));
                    }
                }
            }
        }

        // Ajouter un rôle basé sur le typeUtilisateur (cas où aucun rôle n'est associé)
        if (utilisateur.getTypeUtilisateur() != null && !utilisateur.getTypeUtilisateur().isBlank()) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + utilisateur.getTypeUtilisateur()));
        }

        // Ajouter les permissions directes de l'utilisateur
        if (utilisateur.getPermissions() != null) {
            for (Permission permission : utilisateur.getPermissions()) {
                authorities.add(new SimpleGrantedAuthority(permission.getName()));
            }
        }

        String s = utilisateur.getStatut();
        boolean enabled = s != null && ("ACTIF".equalsIgnoreCase(s) || "ON".equalsIgnoreCase(s) || "ACTIVE".equalsIgnoreCase(s) || "TRUE".equalsIgnoreCase(s) || "1".equals(s));
        // Keep principal username as email for compatibility across the codebase.
        return new UserDetailsImpl(
            utilisateur.getId(),
            utilisateur.getEmail(),
            utilisateur.getEmail(),
            utilisateur.getMotDePasse(),
            authorities,
            enabled);
    }
}