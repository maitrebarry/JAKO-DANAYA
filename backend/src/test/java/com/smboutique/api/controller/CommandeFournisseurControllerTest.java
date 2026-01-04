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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class CommandeFournisseurControllerTest {

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
    public void enregistrerReception_createsReception_updatesStock_andCreatesMouvement() {
        // Setup commande and ligne
        CommandeFournisseur cmd = new CommandeFournisseur();
        cmd.setId(1L);
        Boutique b = new Boutique(); b.setId(10L);
        cmd.setBoutique(b);

        LigneCommande lc = new LigneCommande();
        lc.setId(50L);
        Stock stock = new Stock(); stock.setId(200L); stock.setQuantiteDisponible(5);
        Produit p = new Produit(); p.setId(300L);
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

        // Prepare request with delta=3
        CommandeFournisseurController.ReceptionRequest req = new CommandeFournisseurController.ReceptionRequest();
        CommandeFournisseurController.ReceptionLigne rl = new CommandeFournisseurController.ReceptionLigne();
        rl.setLigneId(50L);
        rl.setQuantiteLivre(3);
        req.setLignes(java.util.List.of(rl));

        ResponseEntity<CommandeFournisseur> resp = commandeController.enregistrerReception(1L, req, 10L);
        assertEquals(200, resp.getStatusCode().value());

        // Verify stock updated
        verify(stockRepository, atLeastOnce()).save(argThat(s -> s.getId().equals(200L) && s.getQuantiteDisponible() == 8));

        // Verify a ligneReception was saved
        verify(ligneReceptionService, times(1)).save(any(LigneReception.class));

        // Verify a mouvement of type RECEPTION was created
        verify(mouvementService, times(1)).save(argThat(m -> "RECEPTION".equals(m.getTypeMouvement()) && m.getQuantite() == 3));
    }

    @Test
    public void create_with_quantiteConditionnement_sets_ligne_quantite_in_units() {
        // Prepare current user in security context
        org.springframework.security.core.Authentication auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.getName()).thenReturn("testuser");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        Utilisateur u = new Utilisateur();
        u.setId(1L);
        Boutique b = new Boutique(); b.setId(10L);
        u.setBoutique(b);
        when(utilisateurService.findByEmail("testuser")).thenReturn(java.util.Optional.of(u));
        when(utilisateurService.hasPermission(u, "COMMANDE_CREER")).thenReturn(true);

        // Prepare stock with product multiplicateur
        Stock stock = new Stock(); stock.setId(500L);
        Produit p = new Produit(); p.setId(600L); p.setNombreUnitesParConditionnement(4);
        stock.setProduit(p);
        when(stockRepository.findById(500L)).thenReturn(Optional.of(stock));

        // Prepare request with quantiteConditionnement=2 -> expected units = 8
        CommandeFournisseurRequest req = new CommandeFournisseurRequest();
        req.setReference("REF-1");
        req.setDateCommande("2026-01-01 10:00");
        CommandeFournisseurRequest.FournisseurDTO fd = new CommandeFournisseurRequest.FournisseurDTO();
        fd.setId(123L);
        req.setFournisseur(fd);
        req.setTotal(8000);
        CommandeFournisseurRequest.ProduitSelectionne ps = new CommandeFournisseurRequest.ProduitSelectionne();
        ps.setId_stock(500L);
        ps.setQuantiteConditionnement(2);
        ps.setPrix(1000);
        req.setProduitsSelectionnes(java.util.List.of(ps));

        when(commandeFournisseurService.save(any(CommandeFournisseur.class))).thenAnswer(invocation -> {
            CommandeFournisseur c = invocation.getArgument(0);
            // debug assertion: ensure controller set quantiteConditionnement on the created ligne before save
            assertNotNull(c.getLignes());
            assertEquals(1, c.getLignes().size());
            assertEquals(Integer.valueOf(2), c.getLignes().get(0).getQuantiteConditionnement());
            c.setId(777L);
            return c;
        });

        ResponseEntity<CommandeFournisseur> resp = commandeController.createCommandeFournisseur(req);
        assertEquals(200, resp.getStatusCode().value());
        CommandeFournisseur saved = resp.getBody();
        assertEquals(1, saved.getLignes().size());
        LigneCommande lcSaved = saved.getLignes().get(0);
        assertEquals(8, lcSaved.getQuantite());
        assertEquals(2, lcSaved.getQuantiteConditionnement());
        assertEquals(1000, lcSaved.getNewPrice());
    }

    @Test
    public void update_with_quantiteConditionnement_updates_existing_ligne_quantity() {
        // Setup authenticated user
        org.springframework.security.core.Authentication auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.getName()).thenReturn("testuser2");
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);

        Utilisateur u = new Utilisateur();
        u.setId(2L);
        Boutique b = new Boutique(); b.setId(20L);
        u.setBoutique(b);
        when(utilisateurService.findByEmail("testuser2")).thenReturn(java.util.Optional.of(u));
        when(utilisateurService.hasPermission(u, "COMMANDE_CREER")).thenReturn(true);

        // Existing commande with one ligne
        CommandeFournisseur cmd = new CommandeFournisseur(); cmd.setId(888L); cmd.setBoutique(b);
        LigneCommande existing = new LigneCommande(); existing.setId(100L);
        Stock stk = new Stock(); stk.setId(400L); Produit prod = new Produit(); prod.setId(401L); prod.setNombreUnitesParConditionnement(5); stk.setProduit(prod); existing.setStock(stk); existing.setQuantite(2);
        when(commandeFournisseurService.findById(888L)).thenReturn(java.util.Optional.of(cmd));
        when(ligneCommandeRepository.findByCommandeFournisseurId(888L)).thenReturn(java.util.List.of(existing));

        // Prepare update request with quantiteConditionnement=3 for same stock
        CommandeFournisseurRequest reqUpd = new CommandeFournisseurRequest();
        reqUpd.setReference("REF-UPD");
        reqUpd.setDateCommande("2026-01-02 12:00");
        reqUpd.setTotal(15000);
        CommandeFournisseurRequest.ProduitSelectionne psel = new CommandeFournisseurRequest.ProduitSelectionne();
        psel.setId_stock(400L);
        psel.setQuantiteConditionnement(3);
        psel.setPrix(500);
        reqUpd.setProduitsSelectionnes(java.util.List.of(psel));

        when(commandeFournisseurService.save(any(CommandeFournisseur.class))).thenAnswer(inv -> inv.getArgument(0));

        ResponseEntity<?> resp = commandeController.updateCommandeFournisseur(888L, reqUpd);
        assertEquals(200, resp.getStatusCode().value());
        // verify that existing ligne has been updated to quantite=15
        verify(ligneCommandeRepository, atLeastOnce()).save(argThat(l -> l.getQuantite() == 15));
    }
}
