package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

public class StockControllerAssignTest {

    @Mock
    private StockService stockService;

    @Mock
    private ProduitService produitService;

    @Mock
    private MagasinRepository magasinRepository;

    @Mock
    private UtilisateurService utilisateurService;

    @InjectMocks
    private com.smboutique.api.controller.StockController stockController;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        // Setup security context for controller methods that rely on authenticated user
        org.springframework.security.core.Authentication auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("user", "pw");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
        com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
        u.setEmail("user");
        com.smboutique.api.model.Permission p = new com.smboutique.api.model.Permission();
        p.setName("INVENTAIRE_CREER");
        u.setPermissions(new java.util.HashSet<>(java.util.List.of(p)));
        when(utilisateurService.findByEmail("user")).thenReturn(Optional.of(u));
    }

    @Test
    public void assignProductToMagasin_createsStockWithZeroQuantity() {
        StockController.AssignRequest req = new StockController.AssignRequest();
        req.produitId = 10L;
        req.magasinId = 20L;

        Produit p = new Produit(); p.setId(10L);
        Magasin m = new Magasin(); m.setId(20L);

        when(produitService.findById(10L)).thenReturn(Optional.of(p));
        when(magasinRepository.findById(20L)).thenReturn(Optional.of(m));
        when(stockService.getStockByProduitAndMagasin(10L, 20L)).thenReturn(Optional.empty());

        Stock saved = new Stock(); saved.setId(555L); saved.setProduit(p); saved.setMagasin(m); saved.setQuantiteDisponible(0);
        when(stockService.saveStock(any(Stock.class))).thenReturn(saved);

        ResponseEntity<?> resp = stockController.assignProductToMagasin(req);
        assertEquals(201, resp.getStatusCode().value());
        Stock body = (Stock) resp.getBody();
        assertEquals(0, body.getQuantiteDisponible());
        assertEquals(20L, body.getMagasin().getId());

        verify(stockService, times(1)).saveStock(any(Stock.class));
    }
}
