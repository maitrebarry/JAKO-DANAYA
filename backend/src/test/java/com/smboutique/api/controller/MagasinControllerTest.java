package com.smboutique.api.controller;

import com.smboutique.api.model.Magasin;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Unite;
import com.smboutique.api.model.Utilisateur;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import com.smboutique.api.service.MagasinService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.UtilisateurService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

public class MagasinControllerTest {

    @Mock
    private MagasinService magasinService;
    @Mock
    private UtilisateurService utilisateurService;
    @Mock
    private ProduitService produitService;
    @Mock
    private StockService stockService;
    @Mock
    private com.smboutique.api.service.TransferService transferService;

    @InjectMocks
    private MagasinController magasinController;

    private Utilisateur current;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        current = new Utilisateur();
        current.setEmail("test@local");
        com.smboutique.api.model.Permission perm1 = new com.smboutique.api.model.Permission();
        perm1.setName("INVENTAIRE_MODIFIER");
        com.smboutique.api.model.Permission perm2 = new com.smboutique.api.model.Permission();
        perm2.setName("INVENTAIRE_LECTURE");
        current.setPermissions(java.util.Set.of(perm1, perm2));
        when(utilisateurService.findByEmail("test@local")).thenReturn(Optional.of(current));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("test@local", "na"));
    }

    @Test
    public void assignProductsToMagasin_createsStocks_andReturnsCount() {
        Magasin m = new Magasin(); m.setId(5L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(2L);
        m.setBoutique(b);
        com.smboutique.api.model.Boutique cb = new com.smboutique.api.model.Boutique(); cb.setId(2L);
        current.setBoutique(cb);
        when(magasinService.findById(5L)).thenReturn(Optional.of(m));

        Produit p1 = new Produit(); p1.setId(10L);
        when(produitService.findById(10L)).thenReturn(Optional.of(p1));
        when(stockService.getStockByProduitAndMagasin(10L, 5L)).thenReturn(Optional.empty());
        when(stockService.getStocksByProduitAndBoutique(10L, 2L)).thenReturn(java.util.List.of());

        java.util.Map<String, java.util.List<Long>> body = new java.util.HashMap<>();
        body.put("productIds", List.of(10L));

        ResponseEntity<?> resp = magasinController.assignProductsToMagasin(5L, body);
        assertEquals(200, resp.getStatusCode().value());
        verify(stockService, times(1)).saveStock(any());
        // also verify response body contains created id
        java.util.Map<?,?> map = (java.util.Map<?,?>) resp.getBody();
        assertEquals(1, map.get("count"));
    }

    @Test
    public void assignProductsToMagasin_createsNewMagasinStock_evenWhenBoutiqueStockExists() {
        Magasin m = new Magasin(); m.setId(5L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(2L);
        m.setBoutique(b);
        com.smboutique.api.model.Boutique cb = new com.smboutique.api.model.Boutique(); cb.setId(2L);
        current.setBoutique(cb);
        when(magasinService.findById(5L)).thenReturn(Optional.of(m));

        Produit p1 = new Produit(); p1.setId(10L);
        when(produitService.findById(10L)).thenReturn(Optional.of(p1));
        when(stockService.getStockByProduitAndMagasin(10L, 5L)).thenReturn(Optional.empty());
        // return a boutique-level stock (magasin == null)
        com.smboutique.api.model.Stock boutiqueStock = new com.smboutique.api.model.Stock();
        boutiqueStock.setId(77L);
        boutiqueStock.setProduit(p1);
        boutiqueStock.setMagasin(null);
        boutiqueStock.setBoutique(b);
        when(stockService.getStocksByProduitAndBoutique(10L, 2L)).thenReturn(java.util.List.of(boutiqueStock));

        java.util.Map<String, java.util.List<Long>> body = new java.util.HashMap<>();
        body.put("productIds", List.of(10L));

        ResponseEntity<?> resp = magasinController.assignProductsToMagasin(5L, body);
        assertEquals(200, resp.getStatusCode().value());
        // verify that a NEW magasin-level stock row was created (saveStock called with a stock that has magasin set and quantiteDisponible == 0)
        verify(stockService, times(1)).saveStock(argThat(s -> {
            com.smboutique.api.model.Stock st = (com.smboutique.api.model.Stock)s;
            return st.getMagasin() != null && st.getMagasin().getId().equals(5L) && (st.getQuantiteDisponible() == null || st.getQuantiteDisponible().intValue() == 0) && (st.getId() == null || !st.getId().equals(77L));
        }));
        // ensure we NEVER modified the existing boutique-level stock (i.e., we didn't save it with magasin set)
        verify(stockService, never()).saveStock(argThat(s -> {
            com.smboutique.api.model.Stock st = (com.smboutique.api.model.Stock)s;
            return st.getId() != null && st.getId().equals(77L) && st.getMagasin() != null;
        }));
        java.util.Map<?,?> map = (java.util.Map<?,?>) resp.getBody();
        assertEquals(1, map.get("count"));
    }

    @Test
    public void transferFromMagasinToBoutique_success() {
        Magasin m = new Magasin(); m.setId(5L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(2L);
        m.setBoutique(b);
        com.smboutique.api.model.Boutique cb = new com.smboutique.api.model.Boutique(); cb.setId(2L);
        current.setBoutique(cb);
        when(magasinService.findById(5L)).thenReturn(Optional.of(m));

        Produit p1 = new Produit(); p1.setId(10L);
        when(produitService.findById(10L)).thenReturn(Optional.of(p1));
        com.smboutique.api.model.Stock magasinStock = new com.smboutique.api.model.Stock(); magasinStock.setId(100L); magasinStock.setProduit(p1); magasinStock.setMagasin(m); magasinStock.setQuantiteDisponible(10);
        when(stockService.getStockByProduitAndMagasin(10L, 5L)).thenReturn(Optional.of(magasinStock));
        com.smboutique.api.model.Stock boutiqueStock = new com.smboutique.api.model.Stock(); boutiqueStock.setId(200L); boutiqueStock.setProduit(p1); boutiqueStock.setQuantiteDisponible(2); boutiqueStock.setMagasin(null); boutiqueStock.setBoutique(b);
        when(stockService.getStocksByProduitAndBoutique(10L, 2L)).thenReturn(java.util.List.of(boutiqueStock));

        // expect transferService.transfer to be called
        doNothing().when(transferService).transfer(100L, 200L, 3);

        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("produitId", 10L);
        body.put("quantite", 3);

        ResponseEntity<?> resp = magasinController.transferFromMagasinToBoutique(5L, body);
        assertEquals(200, resp.getStatusCode().value());
        java.util.Map<?,?> map = (java.util.Map<?,?>) resp.getBody();
        assertEquals(true, map.get("success"));
        assertEquals(3, map.get("quantiteTransferee"));
        verify(transferService, times(1)).transfer(100L, 200L, 3);
    }

    @Test
    public void getStocksForMagasin_returnsList() {
        Magasin m = new Magasin(); m.setId(5L);
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(2L);
        m.setBoutique(b);
        com.smboutique.api.model.Boutique cb = new com.smboutique.api.model.Boutique(); cb.setId(2L);
        current.setBoutique(cb);
        when(magasinService.findById(5L)).thenReturn(Optional.of(m));

        Unite u = new Unite(); u.setId(4L); u.setLibelle("Sacs"); u.setSymbole("Sac");
        Produit p1 = new Produit(); p1.setId(10L); p1.setNomProduit("ProdX"); p1.setUnite(u);
        com.smboutique.api.model.Stock s1 = new com.smboutique.api.model.Stock(); s1.setId(100L); s1.setProduit(p1); s1.setMagasin(m); s1.setQuantiteDisponible(7);
        when(stockService.getStocksByMagasin(5L)).thenReturn(java.util.List.of(s1));

        ResponseEntity<?> resp = magasinController.getStocksForMagasin(5L);
        assertEquals(200, resp.getStatusCode().value());
        java.util.List<?> body = (java.util.List<?>) resp.getBody();
        assertEquals(1, body.size());
        java.util.Map<?,?> first = (java.util.Map<?,?>) body.get(0);
        assertNotNull(first.get("produit"));
        java.util.Map<?,?> prodMap = (java.util.Map<?,?>) first.get("produit");
        assertNotNull(prodMap.get("unite"));
        java.util.Map<?,?> uniteMap = (java.util.Map<?,?>) prodMap.get("unite");
        assertEquals("Sacs", uniteMap.get("libelle"));
    }
}

