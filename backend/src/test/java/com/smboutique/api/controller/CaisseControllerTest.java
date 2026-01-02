package com.smboutique.api.controller;


import com.smboutique.api.model.Caisse;
import com.smboutique.api.model.Boutique;
import com.smboutique.api.service.CaisseService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
public class CaisseControllerTest {

    @InjectMocks
    private CaisseController caisseController;

    @Mock
    private CaisseService caisseService;

    @Mock
    private com.smboutique.api.repository.CaisseRepository caisseRepository;

    @Mock
    private com.smboutique.api.service.CaisseMovementService caisseMovementService;

    // Security helpers
    @Mock
    private com.smboutique.api.security.JwtUtils jwtUtils;

    @Mock
    private com.smboutique.api.security.AuthTokenFilter authTokenFilter;

    @Mock
    private UtilisateurService utilisateurService;

    @BeforeEach
    public void setupSecurityContext() {
        // Mock authentication with a principal name so controller's getCurrentUser() can use it
        Authentication auth = Mockito.mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        org.springframework.security.core.context.SecurityContext ctx = new org.springframework.security.core.context.SecurityContextImpl();
        ctx.setAuthentication(auth);
        SecurityContextHolder.setContext(ctx);
    }

    @Test
    public void createCaisse_withCaisseCreerPermission_shouldReturnOk() throws Exception {
        // setup a boutique
        Boutique b = new Boutique();
        b.setId(1L);

        Caisse input = new Caisse();
        input.setBoutique(b);
        input.setMontantInitial(1000);

        // mock utilisateurService.hasPermission to return true for CAISSE_CREER
        when(utilisateurService.hasPermission(any(), Mockito.eq("CAISSE_CREER"))).thenReturn(true);
        when(utilisateurService.hasPermission(any(), Mockito.eq("CAISSE_GERER"))).thenReturn(false);

        // mock findByEmail to return a user so getCurrentUser() succeeds
        com.smboutique.api.model.Utilisateur user = new com.smboutique.api.model.Utilisateur();
        when(utilisateurService.findByEmail(Mockito.eq("test@example.com"))).thenReturn(Optional.of(user));

        // mock save
        Caisse saved = new Caisse();
        saved.setId(10L);
        saved.setBoutique(b);
        saved.setMontantInitial(1000);
        saved.setReference("TEST-REF");

        when(caisseService.save(any(Caisse.class))).thenReturn(saved);

        // Sanity check: getCurrentUser should resolve
        com.smboutique.api.model.Utilisateur current = ReflectionTestUtils.invokeMethod(caisseController, "getCurrentUser");
        assertEquals(user, current);

        // Call controller directly to avoid web security and MVC configuration
        ResponseEntity<Caisse> response = caisseController.createCaisse(input);
        assertEquals(HttpStatus.OK, response.getStatusCode());
    }
}
