package com.smboutique.api.controller;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.model.Vente;
import com.smboutique.api.model.LigneVente;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.LigneCommandeClient;
import com.smboutique.api.service.VenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@RestController
@RequestMapping("/api/ventes")
@CrossOrigin(origins = "*")
public class VenteController {

    @Autowired
    private VenteService venteService;

    @Autowired
    private com.smboutique.api.service.LigneVenteService ligneVenteService;

    @Autowired
    private com.smboutique.api.repository.StockRepository stockRepository;

    @Autowired
    private com.smboutique.api.service.UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.repository.ClientGrossisteRepository clientGrossisteRepository;

    @Autowired
    private com.smboutique.api.service.CommandeClientService commandeClientService;

    @Autowired
    private com.smboutique.api.service.LigneCommandeClientService ligneCommandeClientService;

    private com.smboutique.api.model.Utilisateur getCurrentUser() {
        org.springframework.security.core.Authentication authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    private boolean isSuperAdmin(com.smboutique.api.model.Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean hasPermission(com.smboutique.api.model.Utilisateur user, String permissionName) {
        if (user == null) return false;
        return user.getPermissions().stream().anyMatch(p -> p.getName().equals(permissionName));
    }

    @GetMapping
    public List<Vente> getAllVentes() {
        return venteService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Vente> getVenteById(@PathVariable Long id) {
        return venteService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Vente> createVente(@RequestBody Vente vente) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return ResponseEntity.ok(venteService.save(vente));
    }

    // Create a Vente with its lignes (used by frontend sale flow)
    public static class VenteLineRequest {
        public Long id_stock;
        // If venteParConditionnement is true, quantiteConditionnement represents the number of conditionnements.
        // Otherwise, quantite represents the number of units.
        public Integer quantite;
        public Boolean venteParConditionnement;
        public Integer quantiteConditionnement;
        public Integer prix;
        public String priceMode; // DETAIL or GROS
    }

    public static class VenteFullRequest {
        public String reference;
        public String dateVente;
        public String nomClient;
        public java.util.Map<String, Object> client; // frontend may send { "id": 12 }
        public java.util.List<VenteLineRequest> produitsSelectionnes = new java.util.ArrayList<>();
        public Integer total;
    }

    @PostMapping("/full")
    @Transactional
    public ResponseEntity<?> createVenteFull(@RequestBody VenteFullRequest request) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_CREER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).body("Permission refusée");
        }

        try {
            // Note: do not validate or decrement stock at vente creation time.
            // Stock availability and decrement will be handled at delivery time (livraison). 
            // Persist CommandeClient and lignes (quantite saved as quantite_reelle)
            CommandeClient cc = new CommandeClient();
            cc.setReference(request.reference);
            cc.setDateCommande(request.dateVente == null ? java.time.LocalDateTime.now() : java.time.LocalDateTime.parse(request.dateVente));
            cc.setTotal(request.total == null ? 0 : request.total);
            cc.setPaie(0);

            // set client if provided
            if (request.client != null && request.client.get("id") != null) {
                Long cid = Long.parseLong(String.valueOf(request.client.get("id")));
                com.smboutique.api.model.ClientGrossiste clientEntity = clientGrossisteRepository.findById(cid).orElse(null);
                if (clientEntity != null) {
                    cc.setClient(clientEntity);
                }
            }

            // set boutique from current user if available
            if (user != null && user.getBoutique() != null) {
                cc.setBoutique(user.getBoutique());
            }

            // set utilisateur (authenticated user) who created this commande
            if (user != null) {
                cc.setUtilisateur(user);
            }

            java.util.List<LigneCommandeClient> lignes = new java.util.ArrayList<>();
            for (VenteLineRequest pl : request.produitsSelectionnes) {
                com.smboutique.api.model.Stock s = stockRepository.findById(pl.id_stock).orElseThrow(() -> new RuntimeException("Stock introuvable"));
                LigneCommandeClient lcc = new LigneCommandeClient();

                int quantiteReelle = 0;
                if (pl.venteParConditionnement != null && pl.venteParConditionnement) {
                    Integer mul = s.getProduit().getNombreUnitesParConditionnement();
                    quantiteReelle = pl.quantiteConditionnement * mul;
                } else {
                    quantiteReelle = pl.quantite == null ? 0 : pl.quantite;
                }

                lcc.setProduit(s.getProduit());
                lcc.setQuantite(quantiteReelle);
                lcc.setQuantiteLivre(0);
                lcc.setNewPrice(pl.prix == null ? 0 : pl.prix);
                // set price mode if provided
                if (pl.priceMode != null) {
                    try {
                        lcc.setPriceMode(com.smboutique.api.model.PriceMode.valueOf(pl.priceMode));
                    } catch (Exception e) {
                        // ignore invalid value
                    }
                }
                lcc.setCommandeClient(cc);
                lignes.add(lcc);

                // Inventory will be updated on delivery (livraison), not at sale creation.
            }

            cc.setLignes(lignes);
            CommandeClient saved = commandeClientService.save(cc);

            return ResponseEntity.ok(saved);
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(ex.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vente> updateVente(@PathVariable Long id, @RequestBody Vente venteDetails) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_MODIFIER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return venteService.findById(id)
                .map(vente -> {
                    vente.setReferenceCaisse(venteDetails.getReferenceCaisse());
                    vente.setDateVente(venteDetails.getDateVente());
                    vente.setMontantTotal(venteDetails.getMontantTotal());
                    vente.setNomClient(venteDetails.getNomClient());
                    return ResponseEntity.ok(venteService.save(vente));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteVente(@PathVariable Long id) {
        Utilisateur user = getCurrentUser();
        if (!hasPermission(user, "VENTE_SUPPRIMER") && !isSuperAdmin(user)) {
            return ResponseEntity.status(403).build();
        }
        return venteService.findById(id)
                .map(vente -> {
                    venteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
