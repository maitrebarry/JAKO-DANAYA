package com.smboutique.api.controller;

import com.smboutique.api.model.*;
import com.smboutique.api.repository.LigneCommandeRepository;
import com.smboutique.api.repository.CommandeFournisseurRepository;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class ReceptionControllerConditionnementTest {

    @Mock
    private CommandeFournisseurService commandeFournisseurService;

    @Mock
    private LigneCommandeRepository ligneCommandeRepository;

    @Mock
    private CommandeFournisseurRepository commandeFournisseurRepository;

    @Mock
    private StockRepository stockRepository;

    @Mock
    private UtilisateurService utilisateurService;

    @Mock
    private PaiementService paiementService;

    @Mock
    private ReceptionService receptionService;

    @Mock
    private LigneReceptionService ligneReceptionService;

    @Mock
    private MouvementService mouvementService;

    @InjectMocks
    private com.smboutique.api.controller.CommandeFournisseurController commandeController;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    public void reception_with_quantiteConditionnement_updates_stock_in_units() {
        // Setup commande and ligne
        CommandeFournisseur cmd = new CommandeFournisseur();
        cmd.setId(1L);
        Boutique b = new Boutique(); b.setId(10L);
        cmd.setBoutique(b);

        LigneCommande lc = new LigneCommande();
        lc.setId(50L);
        Stock stock = new Stock(); stock.setId(200L); stock.setQuantiteDisponible(5); // 5 units currently
        Produit p = new Produit(); p.setId(300L);
        p.setNombreUnitesParConditionnement(4); // 1 conditionnement = 4 units
        stock.setProduit(p);
        lc.setStock(stock);

        when(commandeFournisseurService.findByIdAndBoutiqueId(1L, 10L)).thenReturn(Optional.of(cmd));
        when(ligneCommandeRepository.findById(50L)).thenReturn(Optional.of(lc));
        when(stockRepository.findById(200L)).thenReturn(Optional.of(stock));
        when(receptionService.save(any(Reception.class))).thenAnswer(inv -> {
            Reception r = inv.getArgument(0);
            r.setId(999L);
            return r;
        });

        // Prepare request with quantiteConditionnement=2 -> should add 8 units
        CommandeFournisseurController.ReceptionRequest req = new CommandeFournisseurController.ReceptionRequest();
        CommandeFournisseurController.ReceptionLigne rl = new CommandeFournisseurController.ReceptionLigne();
        rl.setLigneId(50L);
        rl.setQuantiteConditionnement(2);
        req.setLignes(java.util.List.of(rl));

        ResponseEntity<CommandeFournisseur> resp = commandeController.enregistrerReception(1L, req, 10L);
        assertEquals(200, resp.getStatusCode().value());

        // Verify stock updated: 5 + (2*4) = 13
        verify(stockRepository, atLeastOnce()).save(argThat(s -> s.getId().equals(200L) && s.getQuantiteDisponible() == 13));

        // Verify a ligneReception was saved with quantiteRecu set in units and quantiteConditionnement preserved
        verify(ligneReceptionService, times(1)).save(argThat(lrSaved -> lrSaved.getQuantiteRecu() == 8 && (lrSaved.getQuantiteConditionnement() != null && lrSaved.getQuantiteConditionnement() == 2)));

        // Verify mouvement recorded in units
        verify(mouvementService, times(1)).save(argThat(m -> "RECEPTION".equals(m.getTypeMouvement()) && m.getQuantite() == 8));
    }

    @Test
    public void reception_negative_quantiteConditionnement_returns_bad_request_and_no_side_effects() {
        // Setup commande and ligne
        CommandeFournisseur cmd = new CommandeFournisseur();
        cmd.setId(1L);
        Boutique b = new Boutique(); b.setId(10L);
        cmd.setBoutique(b);

        LigneCommande lc = new LigneCommande();
        lc.setId(50L);
        Stock stock = new Stock(); stock.setId(200L); stock.setQuantiteDisponible(5);
        Produit p = new Produit(); p.setId(300L);
        p.setNombreUnitesParConditionnement(4);
        stock.setProduit(p);
        lc.setStock(stock);

        when(commandeFournisseurService.findByIdAndBoutiqueId(1L, 10L)).thenReturn(Optional.of(cmd));
        when(ligneCommandeRepository.findById(50L)).thenReturn(Optional.of(lc));
        when(stockRepository.findById(200L)).thenReturn(Optional.of(stock));

        // Prepare request with negative quantiteConditionnement
        CommandeFournisseurController.ReceptionRequest req = new CommandeFournisseurController.ReceptionRequest();
        CommandeFournisseurController.ReceptionLigne rl = new CommandeFournisseurController.ReceptionLigne();
        rl.setLigneId(50L);
        rl.setQuantiteConditionnement(-1);
        req.setLignes(java.util.List.of(rl));

        ResponseEntity<CommandeFournisseur> resp = commandeController.enregistrerReception(1L, req, 10L);
        assertEquals(400, resp.getStatusCode().value());

        // Verify no stock update, no ligneReception and no mouvement created
        verify(stockRepository, never()).save(any(Stock.class));
        verify(ligneReceptionService, never()).save(any(LigneReception.class));
        verify(mouvementService, never()).save(any(Mouvement.class));
    }
}
