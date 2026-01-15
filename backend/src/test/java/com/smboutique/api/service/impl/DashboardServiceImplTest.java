package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.ClientGrossisteService;
import com.smboutique.api.service.FournisseurService;
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
    StockService stockService;
    @Mock
    com.smboutique.api.service.InventaireService inventaireService;

    DashboardServiceImpl service;

    @BeforeEach
    void setup() {
        service = new DashboardServiceImpl(produitService, clientGrossisteService, fournisseurService, commandeClientService, commandeFournisseurService, stockService, inventaireService);
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
}
