package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

public class StockControllerTest {

    @Mock
    private StockService stockService;

    @Mock
    private ProduitService produitService;

    @Mock
    private MagasinRepository magasinRepository;

    @Mock
    private UtilisateurService utilisateurService;

    @InjectMocks
    private StockController stockController;

    private AutoCloseable mocks;

    @BeforeEach
    public void setUp() {
        mocks = MockitoAnnotations.openMocks(this);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("user", "pw"));
    }

    @AfterEach
    public void tearDown() throws Exception {
        SecurityContextHolder.clearContext();
        mocks.close();
    }

    @Test
    public void createStock_withMagasinAndInitialQty_shouldFail() {
        Utilisateur u = new Utilisateur();
        u.setEmail("user");
        // grant permission INVENTAIRE_CREER
        com.smboutique.api.model.Permission p = new com.smboutique.api.model.Permission();
        p.setName("INVENTAIRE_CREER");
        u.setPermissions(new java.util.HashSet<>(java.util.List.of(p)));

        when(utilisateurService.findByEmail("user")).thenReturn(Optional.of(u));

        Stock s = new Stock();
        Magasin m = new Magasin();
        m.setId(5L);
        s.setMagasin(m);
        s.setQuantiteDisponible(10);

        when(magasinRepository.findById(5L)).thenReturn(Optional.of(m));

        assertThrows(IllegalArgumentException.class, () -> stockController.createStock(s));
    }
}
