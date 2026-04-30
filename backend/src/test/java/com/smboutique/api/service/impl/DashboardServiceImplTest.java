package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.ClientGrossisteService;
import com.smboutique.api.service.FournisseurService;
import com.smboutique.api.service.LigneVenteService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.dto.DashboardPayload;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class DashboardServiceImplTest {

    @Mock
    ProduitService produitService;
    @Mock
    ClientGrossisteService clientGrossisteService;
    @Mock
    FournisseurService fournisseurService;
    @Mock
    CommandeClientService commandeClientService;
    @Mock
    CommandeFournisseurService commandeFournisseurService;
    @Mock
    LigneVenteService ligneVenteService;
    @Mock
    StockService stockService;
    @Mock
    com.smboutique.api.service.InventaireService inventaireService;
    @Mock
    com.smboutique.api.service.VenteService venteService;

    DashboardServiceImpl service;

    @BeforeEach
    void setup() {
        org.mockito.Mockito.lenient().when(ligneVenteService.findAll()).thenReturn(java.util.Collections.emptyList());
        org.mockito.Mockito.lenient().when(venteService.findAll()).thenReturn(java.util.Collections.emptyList());
        service = new DashboardServiceImpl(produitService, clientGrossisteService, fournisseurService, commandeClientService, commandeFournisseurService, stockService, inventaireService, ligneVenteService, venteService);
    }

    @Test
    void superadmin_gets_system_widgets() {
        Utilisateur u = new Utilisateur();
        u.setId(1L);
        u.setTypeUtilisateur("SUPERADMIN");

        when(commandeClientService.findAll()).thenReturn(List.of());
        when(produitService.findAll()).thenReturn(List.of());

        DashboardPayload p = service.getDashboardFor(u, null, null);
        assertThat(p).isNotNull();
        assertThat(p.role).isEqualToIgnoringCase("SUPERADMIN");
        assertThat(p.widgets).containsKey("erreurs_systeme");
        // superadmin widgets should not contain heavy financial keys like valeur_stock
        assertThat(p.widgets).doesNotContainKey("valeur_stock");
    }

    @Test
    void proprietaire_gets_financial_widgets() {
        Utilisateur u = new Utilisateur();
        u.setId(2L);
        u.setTypeUtilisateur("PROPRIETAIRE");
        Boutique b = new Boutique(); b.setId(10L); b.setNom("B1"); u.setBoutique(b);

        when(commandeClientService.findAllByBoutiqueId(10L)).thenReturn(List.of(new CommandeClient()));

        DashboardPayload p = service.getDashboardFor(u, null, null);
        assertThat(p.role).isEqualToIgnoringCase("PROPRIETAIRE");
        assertThat(p.widgets).containsKey("chiffre_affaires_total");
        assertThat(p.widgets).containsKey("valeur_stock");
    }

    @Test
    void gerant_gets_shop_widgets() {
        Utilisateur u = new Utilisateur();
        u.setId(3L);
        u.setTypeUtilisateur("GERANT_BOUTIQUE");
        Boutique b = new Boutique(); b.setId(20L); b.setNom("B2"); u.setBoutique(b);

        when(commandeClientService.findAllByBoutiqueId(20L)).thenReturn(List.of(new CommandeClient()));
        when(stockService.getAllStocks()).thenReturn(List.of());

        DashboardPayload p = service.getDashboardFor(u, null, null);
        assertThat(p.role).isEqualToIgnoringCase("GERANT");
        assertThat(p.widgets).containsKey("ventes_jour");
        assertThat(p.widgets).containsKey("valeur_stock_boutique");
    }

    @Test
    void proprietaire_resume_includes_ventes_especes() {
        Utilisateur u = new Utilisateur();
        u.setId(4L);
        u.setTypeUtilisateur("PROPRIETAIRE");
        Boutique b = new Boutique(); b.setId(10L); b.setNom("B1"); u.setBoutique(b);

        when(commandeClientService.findAllByBoutiqueId(10L)).thenReturn(java.util.Collections.emptyList());
        // prepare a cash sale (Vente) for today
        com.smboutique.api.model.Vente v = new com.smboutique.api.model.Vente();
        v.setId(99L);
        v.setMontantTotal(5000);
        v.setDateVente(java.time.LocalDateTime.now());
        v.setBoutique(b);
        when(venteService.findByBoutiqueId(10L)).thenReturn(java.util.Arrays.asList(v));

        DashboardPayload p = service.getDashboardFor(u, null, null);
        assertThat(p.role).isEqualToIgnoringCase("PROPRIETAIRE");
        assertThat(p.widgets).containsKey("resume_caisse");
        Object resumeObj = p.widgets.get("resume_caisse");
        assertThat(resumeObj).isInstanceOf(java.util.Map.class);
        java.util.Map<?,?> resume = (java.util.Map<?,?>) resumeObj;
        // ventes_especes should be present and equal to the cash sale
        assertThat(resume.get("ventes_especes")).isNotNull();
        assertThat(((Number)resume.get("ventes_especes")).longValue()).isEqualTo(5000L);
        // paiements_complets should include the cash sale
        assertThat(resume.get("paiements_complets")).isNotNull();
        assertThat(((Number)resume.get("paiements_complets")).longValue()).isGreaterThanOrEqualTo(5000L);
    }
}
