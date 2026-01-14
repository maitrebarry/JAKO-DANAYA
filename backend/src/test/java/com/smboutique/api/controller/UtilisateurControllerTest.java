package com.smboutique.api.controller;

import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

public class UtilisateurControllerTest {

    @Mock
    private UtilisateurService utilisateurService;

    @Mock
    private BoutiqueService boutiqueService;

    @InjectMocks
    private UtilisateurController utilisateurController;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void createUser_adminCannotCreateAdmin_returnsForbidden() {
        // prepare current authenticated user with ADMINISTRATEUR role
        Utilisateur current = new Utilisateur();
        Role r = new Role(); r.setName("ADMINISTRATEUR");
        current.setRoles(Set.of(r));
        when(utilisateurService.findByEmail("admin@local")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin@local", "na"));

        // try to create a new user with type ADMINISTRATEUR
        Utilisateur toCreate = new Utilisateur();
        toCreate.setEmail("new@local");
        toCreate.setNom("New");
        toCreate.setTypeUtilisateur("ADMINISTRATEUR");

        ResponseEntity<?> resp = utilisateurController.createUser(toCreate);
        assertEquals(403, resp.getStatusCode().value());
    }

    @Test
    public void createUser_adminCanCreateCaissier_returnsOk() {
        // prepare current authenticated user with ADMINISTRATEUR role
        Utilisateur current = new Utilisateur();
        Role r = new Role(); r.setName("ADMINISTRATEUR");
        current.setRoles(Set.of(r));
        when(utilisateurService.findByEmail("admin@local")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin@local", "na"));

        Utilisateur toCreate = new Utilisateur();
        toCreate.setEmail("cash@local");
        toCreate.setNom("Cash");
        toCreate.setTypeUtilisateur("CAISSIER");

        // Save should be called and return same object -- we stub save
        when(utilisateurService.save(toCreate)).thenReturn(toCreate);

        ResponseEntity<?> resp = utilisateurController.createUser(toCreate);
        assertEquals(200, resp.getStatusCode().value());
    }

    @Test
    public void getCurrentUser_includesRolePermissions() {
        Utilisateur current = new Utilisateur();
        Role r = new Role(); r.setName("ADMINISTRATEUR");
        com.smboutique.api.model.Permission p = new com.smboutique.api.model.Permission();
        p.setName("DOCUMENTS_VOIR");
        r.setPermissions(Set.of(p));
        current.setRoles(Set.of(r));
        when(utilisateurService.findByEmail("me@local")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("me@local", "na"));

        ResponseEntity<Utilisateur> resp = utilisateurController.getCurrentAuthenticatedUser();
        assertEquals(200, resp.getStatusCode().value());
        Utilisateur body = resp.getBody();
        assertEquals(true, body.getPermissions().stream().anyMatch(pp -> "DOCUMENTS_VOIR".equals(pp.getName())));
    }
}
