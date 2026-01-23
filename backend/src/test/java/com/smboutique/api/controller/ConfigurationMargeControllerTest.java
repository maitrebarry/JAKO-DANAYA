package com.smboutique.api.controller;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.ConfigurationMarge;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.ConfigurationMargeService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ConfigurationMargeControllerTest {

    @Mock
    private ConfigurationMargeService configurationMargeService;

    @Mock
    private UtilisateurService utilisateurService;

    @InjectMocks
    private ConfigurationMargeController controller;

    private void mockAuthAsBoutique(long boutiqueId) {
        org.springframework.security.core.Authentication auth = new org.springframework.security.authentication.TestingAuthenticationToken("me", "x");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        Utilisateur u = new Utilisateur();
        Boutique b = new Boutique();
        b.setId(boutiqueId);
        u.setBoutique(b);
        // give the user the CONFIG_MARGE_LECTURE permission so controller allows read
        com.smboutique.api.model.Permission p = new com.smboutique.api.model.Permission();
        p.setName("CONFIG_MARGE_LECTURE");
        u.setPermissions(java.util.Set.of(p));
        u.setRoles(java.util.Collections.emptySet());
        when(utilisateurService.findByEmail(anyString())).thenReturn(Optional.of(u));
    }

    @Test
    public void getByBoutique_returns_404_when_missing() {
        mockAuthAsBoutique(125L);
        when(configurationMargeService.findByBoutiqueId(125L)).thenReturn(Optional.empty());

        ResponseEntity<?> resp = controller.getByBoutique(125L);
        assertEquals(404, resp.getStatusCodeValue());
    }

    @Test
    public void getByBoutique_returns_200_when_present() {
        mockAuthAsBoutique(125L);
        ConfigurationMarge cfg = new ConfigurationMarge();
        cfg.setId(11L);
        cfg.setBoutique(new Boutique());
        cfg.getBoutique().setId(125L);
        when(configurationMargeService.findByBoutiqueId(125L)).thenReturn(Optional.of(cfg));

        ResponseEntity<?> resp = controller.getByBoutique(125L);
        assertEquals(200, resp.getStatusCodeValue());
        assertNotNull(resp.getBody());
    }
}
