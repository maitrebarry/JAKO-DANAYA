package com.smboutique.api.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.UtilisateurService;
import com.smboutique.api.service.dto.DashboardOverviewDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
public class DashboardControllerIntegrationTest {

    private MockMvc mockMvc;

    @Mock
    private CommandeClientService commandeClientService;

    @Mock
    private UtilisateurService utilisateurService;

    @Mock
    private StockService stockService;

    @Mock
    private com.smboutique.api.service.DashboardService dashboardService;

    @Mock
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @Mock
    private com.smboutique.api.security.JwtUtils jwtUtils;

    @Mock
    private org.springframework.security.core.userdetails.UserDetailsService userDetailsService;

    @Mock
    private com.smboutique.api.repository.UtilisateurRepository utilisateurRepository;

    private ObjectMapper objectMapper = new ObjectMapper();

    private Utilisateur ownerUser;
    private Utilisateur managerUser;
    private Utilisateur cashierUser;
    private Utilisateur superAdminUser;

    @BeforeEach
    public void setup() {
        MockitoAnnotations.openMocks(this);

        ownerUser = new Utilisateur();
        ownerUser.setId(10L);
        ownerUser.setEmail("owner@example.com");
        ownerUser.setTypeUtilisateur("PROPRIETAIRE");
        com.smboutique.api.model.Boutique ownerBoutique = new com.smboutique.api.model.Boutique();
        ownerBoutique.setId(77L);
        ownerBoutique.setNom("OwnerShop");
        ownerUser.setBoutique(ownerBoutique);

        managerUser = new Utilisateur();
        managerUser.setId(11L);
        managerUser.setEmail("manager@example.com");
        managerUser.setTypeUtilisateur("GERANT_BOUTIQUE");

        cashierUser = new Utilisateur();
        cashierUser.setId(12L);
        cashierUser.setEmail("cashier@example.com");
        cashierUser.setTypeUtilisateur("CAISSIER");

        superAdminUser = new Utilisateur();
        superAdminUser.setId(1L);
        superAdminUser.setEmail("sa@example.com");
        superAdminUser.setTypeUtilisateur("SUPERADMIN");

        DashboardOverviewDTO dto = new DashboardOverviewDTO();
        dto.setSalesTotal(100000L);
        dto.setSalesToday(5000L);
        dto.setPendingOrders(2L);
        dto.setLowStockCount(3L);
        // ensure commandeClientService returns empty lists for personal sales computations
        when(commandeClientService.findAll()).thenReturn(List.of());
        when(commandeClientService.findAllByBoutiqueId(anyLong())).thenReturn(List.of());

        when(dashboardService.getOverview(anyLong())).thenReturn(dto);
        when(dashboardService.getOverview((Long) Mockito.isNull())).thenReturn(dto);
        when(boutiqueRepository.count()).thenReturn(5L);
        when(boutiqueRepository.findAll()).thenReturn(List.of(ownerBoutique));

        // stockService and utilisateurService mocks
        when(utilisateurService.findByEmail("owner@example.com")).thenReturn(java.util.Optional.of(ownerUser));
        when(utilisateurService.findByEmail("manager@example.com")).thenReturn(java.util.Optional.of(managerUser));
        when(utilisateurService.findByEmail("cashier@example.com")).thenReturn(java.util.Optional.of(cashierUser));
        when(utilisateurService.findByEmail("sa@example.com")).thenReturn(java.util.Optional.of(superAdminUser));

        // build controller and standalone MockMvc (avoid loading full Spring context)
        DashboardController controller = new DashboardController(commandeClientService, utilisateurService, stockService, dashboardService, boutiqueRepository);
        this.mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    public void superadminGetsSystemWidgets() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("sa@example.com", "N/A", java.util.List.of(new SimpleGrantedAuthority("ROLE_SUPERADMIN"))));
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("SUPERADMIN")))
                .andExpect(jsonPath("$.widgets.shopsCount").value(5))
                .andExpect(jsonPath("$.widgets.servicesStatus.api").value("OK"))
                .andExpect(jsonPath("$.sections[0].role").value("SUPERADMIN"))
                .andExpect(jsonPath("$.sections[0].widgets[?(@.key=='shopsCount')]").exists());
    }

    @Test
    public void ownerGetsOwnerWidgets() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("owner@example.com", "N/A", java.util.List.of(new SimpleGrantedAuthority("ROLE_PROPRIETAIRE"))));
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("PROPRIETAIRE")))
                .andExpect(jsonPath("$.widgets.chiffre_affaires_total").value(100000))
                .andExpect(jsonPath("$.sections[0].role").value("PROPRIETAIRE"))
                .andExpect(jsonPath("$.sections[0].widgets[?(@.key=='chiffre_affaires_total')]").exists());
    }

    @Test
    public void managerGetsManagerWidgets() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("manager@example.com", "N/A", java.util.List.of(new SimpleGrantedAuthority("ROLE_MANAGER"))));
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("GERANT")))
                .andExpect(jsonPath("$.widgets.ventes_jour").value(5000))
                .andExpect(jsonPath("$.sections[0].role").value("GERANT"))
                .andExpect(jsonPath("$.sections[0].widgets[?(@.key=='ventes_jour')]").exists());
    }

    @Test
    public void cashierGetsCashierWidgets() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("cashier@example.com", "N/A", java.util.List.of(new SimpleGrantedAuthority("ROLE_CAISSIER"))));
        mockMvc.perform(get("/api/dashboard"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role", is("CAISSIER")))
                .andExpect(jsonPath("$.widgets.ventes_jour_personnelles").exists())
                .andExpect(jsonPath("$.sections[0].role").value("CAISSIER"))
                .andExpect(jsonPath("$.sections[0].widgets[?(@.key=='ventes_jour_personnelles')]").exists());
    }
}