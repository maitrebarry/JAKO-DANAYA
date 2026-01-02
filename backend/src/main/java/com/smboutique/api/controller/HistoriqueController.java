package com.smboutique.api.controller;

import com.smboutique.api.dto.ReceptionStatusDTO;
import com.smboutique.api.model.Paiement;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.PaiementService;
import com.smboutique.api.service.ReceptionService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/historique")
@CrossOrigin(origins = "*")
public class HistoriqueController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(HistoriqueController.class);

    @Autowired
    private ReceptionService receptionService;

    @Autowired
    private PaiementService paiementService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.CommandeFournisseurService commandeFournisseurService;

    @Autowired
    private com.smboutique.api.service.LivraisonService livraisonService;

    @Autowired
    private com.smboutique.api.service.PaiementClientService paiementClientService;

    @Autowired
    private com.smboutique.api.service.VenteService venteService;

    private Utilisateur getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("Utilisateur authentifié introuvable");
        }
        return utilisateurService.findByEmail(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Utilisateur authentifié introuvable"));
    }

    public static class HistoriqueItem {
        public String type; // RECEPTION or PAIEMENT
        public Long id; // id of the entity (reception or paiement)
        public String date; // formatted for display (dd/MM/yyyy HH:mm:ss)
        public String dateIso; // iso string for sorting (yyyy-MM-ddTHH:mm:ss)
        public String reference; // reception ref or paiement reference
        public Long referenceCommandeId;
        public String referenceCommande;
        public String fournisseur;
        public String responsable; // utilisateur responsible for the operation (display name)
        public String client;
        public Double montant; // only for paiements
        // Optional: show reference caisse for paiements if user has required permission
        public String referenceCaisse;
        // Cancellation metadata (nullable)
        public Boolean annule;
        public String annuleAt;
        public String annuleReason;
        // cancellation actor: user id and optional display name
        public Long annulePar;
        public String annuleParNom;
    }

    @GetMapping("/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getHistoriqueByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }
        // Determine whether current user can see caisse reference in paiement entries
        boolean canSeeCaisse = isSuperAdmin(current) || (current != null && (utilisateurService.hasPermission(current, "CAISSE_VOIR") || utilisateurService.hasPermission(current, "CAISSE_LECTURE")));
        List<HistoriqueItem> items = new ArrayList<>();

        // Receptions status
        java.util.List<com.smboutique.api.dto.ReceptionStatusDTO> receptions = receptionService.getReceptionsStatusByBoutique(boutiqueId);
        DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

        for (ReceptionStatusDTO r : receptions) {
            // Skip cancelled receptions from the main historique list
            boolean isCancelled = false;
            if (r.getIdReception() != null) {
                java.util.Optional<com.smboutique.api.model.Reception> recOpt = receptionService.findById(r.getIdReception());
                if (recOpt.isPresent()) {
                    com.smboutique.api.model.Reception rec = recOpt.get();
                    if (rec.getAnnule() != null && rec.getAnnule()) isCancelled = true;
                }
            }
            if (isCancelled) continue;

            HistoriqueItem it = new HistoriqueItem();
            it.type = "RECEPTION";
            it.id = r.getIdReception();
            if (r.getDateReception() != null) {
                // Interpret server LocalDateTime in the server zone and return an ISO string with that offset
                java.time.ZonedDateTime z = r.getDateReception().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            } else {
                it.date = null;
                it.dateIso = null;
            }
            it.reference = r.getReceptRef();
            // include commande id if present
            it.referenceCommandeId = r.getIdCommandeFournisseur();
            // fetch commande details if available
            if (r.getIdCommandeFournisseur() != null) {
                commandeFournisseurService.findById(r.getIdCommandeFournisseur()).ifPresent(cmd -> {
                    it.referenceCommande = cmd.getReference();
                    if (cmd.getFournisseur() != null) it.fournisseur = cmd.getFournisseur().getNom() + " " + cmd.getFournisseur().getPrenom();
                });
            }
            items.add(it);
        }

        // Paiements
        java.util.List<Paiement> paiements = paiementService.findByBoutiqueId(boutiqueId);
        for (Paiement p : paiements) {
            // Skip cancelled paiements from main historique
            if (p.getAnnule() != null && p.getAnnule()) continue;

            HistoriqueItem it = new HistoriqueItem();
            it.type = "PAIEMENT";
            it.id = p.getId();
            if (p.getDatePaie() != null) {
                java.time.ZonedDateTime z = p.getDatePaie().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            } else {
                it.date = null;
                it.dateIso = null;
            }
            it.reference = p.getReference();
            it.referenceCommandeId = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getId() : null;
            it.referenceCommande = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getReference() : null;
            it.fournisseur = p.getCommandeFournisseur() != null && p.getCommandeFournisseur().getFournisseur() != null ? p.getCommandeFournisseur().getFournisseur().getNom() + " " + p.getCommandeFournisseur().getFournisseur().getPrenom() : null;
            it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;
            items.add(it);
        }

        List<HistoriqueItem> sorted = items.stream()
                .sorted(Comparator.comparing((HistoriqueItem i) -> {
                    if (i.dateIso == null) return java.time.Instant.MIN;
                    try {
                        return java.time.OffsetDateTime.parse(i.dateIso).toInstant();
                    } catch (Exception e) {
                        // fallback: try parse as LocalDateTime without offset
                        try {
                            return java.time.LocalDateTime.parse(i.dateIso).atZone(java.time.ZoneId.systemDefault()).toInstant();
                        } catch (Exception ex) {
                            return java.time.Instant.MIN;
                        }
                    }
                }).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    @GetMapping("/annulations/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getAnnulationsByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }

        List<HistoriqueItem> items = new ArrayList<>();
        DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

        // Receptions that are cancelled
        java.util.List<com.smboutique.api.dto.ReceptionStatusDTO> receptions = receptionService.getReceptionsStatusByBoutique(boutiqueId);
        for (ReceptionStatusDTO r : receptions) {
            if (r.getIdReception() == null) continue;
            java.util.Optional<com.smboutique.api.model.Reception> recOpt = receptionService.findById(r.getIdReception());
            if (recOpt.isEmpty()) continue;
            com.smboutique.api.model.Reception rec = recOpt.get();
            if (rec.getAnnule() == null || !rec.getAnnule()) continue;

            HistoriqueItem it = new HistoriqueItem();
            it.type = "RECEPTION";
            it.id = rec.getId();
            if (rec.getDateReception() != null) {
                java.time.ZonedDateTime z = rec.getDateReception().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = rec.getReference();
            it.annule = true;
            if (rec.getAnnuleAt() != null) it.annuleAt = rec.getAnnuleAt().format(displayFormatter);
            it.annuleReason = rec.getAnnuleReason();
            // who cancelled
            it.annulePar = rec.getAnnulePar();
            if (rec.getAnnulePar() != null) {
                utilisateurService.findById(rec.getAnnulePar()).ifPresent(u -> it.annuleParNom = (u.getNom() != null ? u.getNom() : "") + " " + (u.getPrenom() != null ? u.getPrenom() : ""));
            }

            if (rec.getCommandeFournisseur() != null) {
                it.referenceCommandeId = rec.getCommandeFournisseur().getId();
                it.referenceCommande = rec.getCommandeFournisseur().getReference();
                if (rec.getCommandeFournisseur().getFournisseur() != null)
                    it.fournisseur = rec.getCommandeFournisseur().getFournisseur().getNom() + " " + rec.getCommandeFournisseur().getFournisseur().getPrenom();
            }
            items.add(it);
        }

        // Paiements cancelled
        java.util.List<Paiement> paiements = paiementService.findByBoutiqueId(boutiqueId);
        for (Paiement p : paiements) {
            if (p.getAnnule() == null || !p.getAnnule()) continue;
            HistoriqueItem it = new HistoriqueItem();
            it.type = "PAIEMENT";
            it.id = p.getId();
            if (p.getDatePaie() != null) {
                java.time.ZonedDateTime z = p.getDatePaie().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = p.getReference();
            it.annule = true;
            if (p.getAnnuleAt() != null) it.annuleAt = p.getAnnuleAt().format(displayFormatter);
            it.annuleReason = p.getAnnuleReason();
            // who cancelled
            it.annulePar = p.getAnnulePar();
            if (p.getAnnulePar() != null) {
                utilisateurService.findById(p.getAnnulePar()).ifPresent(u -> it.annuleParNom = (u.getNom() != null ? u.getNom() : "") + " " + (u.getPrenom() != null ? u.getPrenom() : ""));
            }
            it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;
            it.referenceCommandeId = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getId() : null;
            it.referenceCommande = p.getCommandeFournisseur() != null ? p.getCommandeFournisseur().getReference() : null;
            it.fournisseur = p.getCommandeFournisseur() != null && p.getCommandeFournisseur().getFournisseur() != null ? p.getCommandeFournisseur().getFournisseur().getNom() + " " + p.getCommandeFournisseur().getFournisseur().getPrenom() : null;
            items.add(it);
        }

        List<HistoriqueItem> sorted = items.stream()
                .sorted(Comparator.comparing((HistoriqueItem i) -> {
                    if (i.dateIso == null) return java.time.Instant.MIN;
                    try {
                        return java.time.OffsetDateTime.parse(i.dateIso).toInstant();
                    } catch (Exception e) {
                        try {
                            return java.time.LocalDateTime.parse(i.dateIso).atZone(java.time.ZoneId.systemDefault()).toInstant();
                        } catch (Exception ex) {
                            return java.time.Instant.MIN;
                        }
                    }
                }).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    // --- VENTES historique ---
    @GetMapping("/ventes/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getVentesHistoriqueByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }

        // Determine whether current user can see caisse reference in paiement entries
        boolean canSeeCaisse = isSuperAdmin(current) || (current != null && (utilisateurService.hasPermission(current, "CAISSE_VOIR") || utilisateurService.hasPermission(current, "CAISSE_LECTURE")));
        // Debug log: record permissions and visibility decision
        try {
            java.util.List<String> perms = current != null && current.getPermissions() != null ? current.getPermissions().stream().map(p -> p.getName()).sorted().toList() : java.util.Collections.emptyList();
            log.info("getVentesHistoriqueByBoutique: user={} canSeeCaisse={} perms={}", current != null ? current.getEmail() : "ANONYMOUS", canSeeCaisse, perms);
        } catch (Exception e) {
            log.warn("Unable to log permissions for user while computing canSeeCaisse: {}", e.getMessage());
        }

        List<HistoriqueItem> itemsV = new ArrayList<>();
        DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

        // Livraisons (exclude cancelled)
        java.util.List<com.smboutique.api.model.Livraison> livs = livraisonService.findByBoutiqueId(boutiqueId);
        // Debug logging: report counts and sample references
        if (log.isDebugEnabled() || log.isInfoEnabled()) {
            try {
                long totalLiv = livs == null ? 0 : livs.size();
                String sampleRefs = "";
                if (livs != null && !livs.isEmpty()) {
                    sampleRefs = livs.stream().limit(5).map(lx -> (lx.getReference() == null ? "(no-ref)" : lx.getReference())).collect(java.util.stream.Collectors.joining(", "));
                }
                log.info("getVentesHistoriqueByBoutique: found {} livraisons for boutique {} sampleRefs=[{}]", totalLiv, boutiqueId, sampleRefs);
            } catch (Exception e) {
                log.warn("getVentesHistoriqueByBoutique: unable to log livraison sample", e);
            }
        }
        for (com.smboutique.api.model.Livraison l : livs) {
            if (l.getAnnule() != null && l.getAnnule()) continue;
            HistoriqueItem it = new HistoriqueItem();
            it.type = "LIVRAISON";
            it.id = l.getId();
            if (l.getDateLivraison() != null) {
                java.time.ZonedDateTime z = l.getDateLivraison().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = l.getReference();
            if (l.getCommandeClient() != null) {
                it.referenceCommandeId = l.getCommandeClient().getId();
                it.referenceCommande = l.getCommandeClient().getReference();
                if (l.getCommandeClient().getClient() != null)
                    it.fournisseur = l.getCommandeClient().getClient().getNom() + " " + l.getCommandeClient().getClient().getPrenom();
                if (l.getCommandeClient().getUtilisateur() != null) {
                    it.responsable = (l.getCommandeClient().getUtilisateur().getNom() != null ? l.getCommandeClient().getUtilisateur().getNom() : "") + " " + (l.getCommandeClient().getUtilisateur().getPrenom() != null ? l.getCommandeClient().getUtilisateur().getPrenom() : "");
                }
            }
            itemsV.add(it);
        }

        // Paiements clients (exclude cancelled)
        java.util.List<com.smboutique.api.model.PaiementClient> paies = paiementClientService.findByBoutiqueId(boutiqueId);
        for (com.smboutique.api.model.PaiementClient p : paies) {
            if (p.getAnnule() != null && p.getAnnule()) continue;
            HistoriqueItem it = new HistoriqueItem();
            it.type = "PAIEMENT";
            it.id = p.getId();
            if (p.getDatePaie() != null) {
                java.time.ZonedDateTime z = p.getDatePaie().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = p.getReference();
            it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;
            if (p.getCommandeClient() != null) {
                it.referenceCommandeId = p.getCommandeClient().getId();
                it.referenceCommande = p.getCommandeClient().getReference();
                if (p.getCommandeClient().getClient() != null)
                    it.fournisseur = p.getCommandeClient().getClient().getNom() + " " + p.getCommandeClient().getClient().getPrenom();
                if (p.getCommandeClient().getUtilisateur() != null) {
                    it.responsable = (p.getCommandeClient().getUtilisateur().getNom() != null ? p.getCommandeClient().getUtilisateur().getNom() : "") + " " + (p.getCommandeClient().getUtilisateur().getPrenom() != null ? p.getCommandeClient().getUtilisateur().getPrenom() : "");
                }
            }
            // include reference caisse only if the current user has caisse viewing permissions
            it.referenceCaisse = canSeeCaisse ? p.getReferenceCaisse() : null;
            itemsV.add(it);
        }

        List<HistoriqueItem> sortedV = itemsV.stream()
                .sorted(Comparator.comparing((HistoriqueItem i) -> {
                    if (i.dateIso == null) return java.time.Instant.MIN;
                    try {
                        return java.time.OffsetDateTime.parse(i.dateIso).toInstant();
                    } catch (Exception e) {
                        try {
                            return java.time.LocalDateTime.parse(i.dateIso).atZone(java.time.ZoneId.systemDefault()).toInstant();
                        } catch (Exception ex) {
                            return java.time.Instant.MIN;
                        }
                    }
                }).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sortedV);
    }

    // --- VENTES EN ESPÈCES (PAIEMENTS CLIENTS) ---
    @GetMapping("/ventes/especes/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getVentesEspecesByBoutique(@PathVariable Long boutiqueId) {
        try {
            // Add defensive logging to help diagnose 401/403 cases where authentication or permission checks fail
            try {
                org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                log.info("getVentesEspecesByBoutique: entry - boutiqueId={} authenticationPresent={}", boutiqueId, auth != null);
                if (auth != null) log.debug("getVentesEspecesByBoutique: auth principal={} authorities={}", auth.getPrincipal(), auth.getAuthorities());
            } catch (Exception e) {
                log.warn("getVentesEspecesByBoutique: unable to inspect SecurityContext: {}", e.getMessage());
            }

            Utilisateur current;
            try {
                current = getCurrentUser();
            } catch (RuntimeException ex) {
                // Authentication exists in SecurityContext but cannot be resolved to an application user
                log.warn("getVentesEspecesByBoutique: getCurrentUser failed: {}", ex.getMessage());
                // return 401 to indicate authentication problem
                return ResponseEntity.status(401).build();
            }

            // Check boutique access and return 403 if user is not allowed
            if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
                log.info("getVentesEspecesByBoutique: access denied for user={} userBoutiqueId={} requestedBoutiqueId={}", current != null ? current.getEmail() : "ANON", current != null && current.getBoutique() != null ? current.getBoutique().getId() : null, boutiqueId);
                return ResponseEntity.status(403).build();
            }

            boolean canSeeCaisse = isSuperAdmin(current) || (current != null && (utilisateurService.hasPermission(current, "CAISSE_VOIR") || utilisateurService.hasPermission(current, "CAISSE_LECTURE")));
            try {
                java.util.List<String> perms = current != null && current.getPermissions() != null ? current.getPermissions().stream().map(p -> p.getName()).sorted().toList() : java.util.Collections.emptyList();
                log.info("getVentesEspecesByBoutique: user={} canSeeCaisse={} perms={}", current != null ? current.getEmail() : "ANON", canSeeCaisse, perms);
            } catch (Exception e) {
                log.warn("Unable to log permissions for user while computing canSeeCaisse: {}", e.getMessage());
            }

            List<HistoriqueItem> items = new ArrayList<>();
            DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

            java.util.List<com.smboutique.api.model.PaiementClient> paies;
            try {
                paies = paiementClientService.findByBoutiqueId(boutiqueId);
            } catch (Exception ex) {
                log.error("getVentesEspecesByBoutique: failed to fetch paiements for boutique {}: {}", boutiqueId, ex.getMessage(), ex);
                return ResponseEntity.status(500).build();
            }

            try {
                java.util.List<String> sampleRefs = paies == null ? java.util.Collections.emptyList() : paies.stream().limit(5).map(p -> p.getReference() == null ? "(no-ref)" : p.getReference()).collect(java.util.stream.Collectors.toList());
                log.info("getVentesEspecesByBoutique: found {} paiements for boutique {} sampleRefs={}", paies == null ? 0 : paies.size(), boutiqueId, sampleRefs);
            } catch (Exception e) {
                log.warn("getVentesEspecesByBoutique: unable to log paiement sample", e);
            }

            for (com.smboutique.api.model.PaiementClient p : paies) {
                if (p.getAnnule() != null && p.getAnnule()) continue;
                HistoriqueItem it = new HistoriqueItem();
                it.type = "PAIEMENT";
                it.id = p.getId();
                if (p.getDatePaie() != null) {
                    java.time.ZonedDateTime z = p.getDatePaie().atZone(java.time.ZoneId.systemDefault());
                    it.date = z.format(displayFormatter);
                    it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                }
                it.reference = p.getReference();
                it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;

                if (p.getCommandeClient() != null) {
                    it.referenceCommandeId = p.getCommandeClient().getId();
                    it.referenceCommande = p.getCommandeClient().getReference();
                    if (p.getCommandeClient().getClient() != null)
                        it.fournisseur = p.getCommandeClient().getClient().getNom() + " " + p.getCommandeClient().getClient().getPrenom();
                    if (p.getCommandeClient().getUtilisateur() != null) {
                        it.responsable = (p.getCommandeClient().getUtilisateur().getNom() != null ? p.getCommandeClient().getUtilisateur().getNom() : "") + " " + (p.getCommandeClient().getUtilisateur().getPrenom() != null ? p.getCommandeClient().getUtilisateur().getPrenom() : "");
                    }
                }
                it.referenceCaisse = canSeeCaisse ? p.getReferenceCaisse() : null;
                items.add(it);
            }

            // Also include cash sales from Vente table (if any) for this boutique so 'Ventes en Espèces' shows them
            try {
                java.util.List<com.smboutique.api.model.Vente> ventes = venteService.findByBoutiqueId(boutiqueId);
                java.util.List<String> sampleVentes = ventes == null ? java.util.Collections.emptyList() : ventes.stream().limit(5).map(v -> v.getId() == null ? "(no-id)" : String.valueOf(v.getId())).collect(java.util.stream.Collectors.toList());
                log.info("getVentesEspecesByBoutique: found {} ventes for boutique {} sampleIds={}", ventes == null ? 0 : ventes.size(), boutiqueId, sampleVentes);
                for (com.smboutique.api.model.Vente v : ventes) {
                    HistoriqueItem itv = new HistoriqueItem();
                    itv.type = "VENTE";
                    itv.id = v.getId();
                    if (v.getDateVente() != null) {
                        java.time.ZonedDateTime z = v.getDateVente().atZone(java.time.ZoneId.systemDefault());
                        itv.date = z.format(displayFormatter);
                        itv.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                    }
                    itv.reference = v.getReferenceCaisse();
                    itv.montant = v.getMontantTotal() != null ? v.getMontantTotal().doubleValue() : null;
                    itv.client = v.getNomClient();
                    if (v.getUtilisateur() != null) itv.responsable = (v.getUtilisateur().getNom() != null ? v.getUtilisateur().getNom() : "") + " " + (v.getUtilisateur().getPrenom() != null ? v.getUtilisateur().getPrenom() : "");
                    itv.referenceCaisse = v.getReferenceCaisse();
                    items.add(itv);
                }
            } catch (Exception e) {
                log.warn("getVentesEspecesByBoutique: unable to include ventes from Vente table: {}", e.getMessage());
            }

            List<HistoriqueItem> sorted = items.stream()
                    .sorted(Comparator.comparing((HistoriqueItem i) -> {
                        if (i.dateIso == null) return java.time.Instant.MIN;
                        try {
                            return java.time.OffsetDateTime.parse(i.dateIso).toInstant();
                        } catch (Exception e) {
                            try {
                                return java.time.LocalDateTime.parse(i.dateIso).atZone(java.time.ZoneId.systemDefault()).toInstant();
                            } catch (Exception ex) {
                                return java.time.Instant.MIN;
                            }
                        }
                    }).reversed())
                    .collect(Collectors.toList());

            return ResponseEntity.ok(sorted);
        } catch (Exception e) {
            log.error("getVentesEspecesByBoutique: unexpected error", e);
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/ventes/annulations/boutique/{boutiqueId}")
    public ResponseEntity<List<HistoriqueItem>> getVentesAnnulationsByBoutique(@PathVariable Long boutiqueId) {
        Utilisateur current = getCurrentUser();
        if (!isSuperAdmin(current) && (current.getBoutique() == null || !current.getBoutique().getId().equals(boutiqueId))) {
            return ResponseEntity.status(403).build();
        }

        List<HistoriqueItem> items = new ArrayList<>();
        DateTimeFormatter displayFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

        // Livraisons that are cancelled
        java.util.List<com.smboutique.api.model.Livraison> livs = livraisonService.findByBoutiqueId(boutiqueId);
        for (com.smboutique.api.model.Livraison l : livs) {
            if (l.getAnnule() == null || !l.getAnnule()) continue;
            HistoriqueItem it = new HistoriqueItem();
            it.type = "LIVRAISON";
            it.id = l.getId();
            if (l.getDateLivraison() != null) {
                java.time.ZonedDateTime z = l.getDateLivraison().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = l.getReference();
            it.annule = true;
            if (l.getAnnuleAt() != null) it.annuleAt = l.getAnnuleAt().format(displayFormatter);
            it.annuleReason = l.getAnnuleReason();
            it.annulePar = l.getAnnulePar();
            if (l.getAnnulePar() != null) {
                utilisateurService.findById(l.getAnnulePar()).ifPresent(u -> it.annuleParNom = (u.getNom() != null ? u.getNom() : "") + " " + (u.getPrenom() != null ? u.getPrenom() : ""));
            }
            if (l.getCommandeClient() != null) {
                it.referenceCommandeId = l.getCommandeClient().getId();
                it.referenceCommande = l.getCommandeClient().getReference();
                if (l.getCommandeClient().getClient() != null) it.fournisseur = l.getCommandeClient().getClient().getNom() + " " + l.getCommandeClient().getClient().getPrenom();
            }
            items.add(it);
        }

        // Paiements clients that are cancelled
        // Ensure we know if caller can see caisse references here as well (same logic as above)
        boolean canSeeCaisse = isSuperAdmin(current) || (current != null && (utilisateurService.hasPermission(current, "CAISSE_VOIR") || utilisateurService.hasPermission(current, "CAISSE_LECTURE")));
        try {
            java.util.List<String> perms2 = current != null && current.getPermissions() != null ? current.getPermissions().stream().map(p -> p.getName()).sorted().toList() : java.util.Collections.emptyList();
            log.info("getVentesHistoriqueAnnulations: user={} canSeeCaisse={} perms={}", current != null ? current.getEmail() : "ANONYMOUS", canSeeCaisse, perms2);
        } catch (Exception e) {
            log.warn("Unable to log permissions for user in annulations path: {}", e.getMessage());
        }
        java.util.List<com.smboutique.api.model.PaiementClient> paies = paiementClientService.findByBoutiqueId(boutiqueId);
        for (com.smboutique.api.model.PaiementClient p : paies) {
            if (p.getAnnule() == null || !p.getAnnule()) continue;
            HistoriqueItem it = new HistoriqueItem();
            it.type = "PAIEMENT";
            it.id = p.getId();
            if (p.getDatePaie() != null) {
                java.time.ZonedDateTime z = p.getDatePaie().atZone(java.time.ZoneId.systemDefault());
                it.date = z.format(displayFormatter);
                it.dateIso = z.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            }
            it.reference = p.getReference();
            it.annule = true;
            if (p.getAnnuleAt() != null) it.annuleAt = p.getAnnuleAt().format(displayFormatter);
            it.annuleReason = p.getAnnuleReason();
            it.annulePar = p.getAnnulePar();
            if (p.getAnnulePar() != null) {
                utilisateurService.findById(p.getAnnulePar()).ifPresent(u -> it.annuleParNom = (u.getNom() != null ? u.getNom() : "") + " " + (u.getPrenom() != null ? u.getPrenom() : ""));
            }
            it.montant = p.getMontantPaye() != null ? p.getMontantPaye().doubleValue() : null;
            if (p.getCommandeClient() != null) {
                it.referenceCommandeId = p.getCommandeClient().getId();
                it.referenceCommande = p.getCommandeClient().getReference();
                if (p.getCommandeClient().getClient() != null) it.fournisseur = p.getCommandeClient().getClient().getNom() + " " + p.getCommandeClient().getClient().getPrenom();
                if (p.getCommandeClient().getUtilisateur() != null) {
                    it.responsable = (p.getCommandeClient().getUtilisateur().getNom() != null ? p.getCommandeClient().getUtilisateur().getNom() : "") + " " + (p.getCommandeClient().getUtilisateur().getPrenom() != null ? p.getCommandeClient().getUtilisateur().getPrenom() : "");
                }
            }
            // include reference caisse only if the current user has caisse viewing permissions
            it.referenceCaisse = canSeeCaisse ? p.getReferenceCaisse() : null;
            items.add(it);
        }

        List<HistoriqueItem> sorted = items.stream()
                .sorted(Comparator.comparing((HistoriqueItem i) -> {
                    if (i.dateIso == null) return java.time.Instant.MIN;
                    try {
                        return java.time.OffsetDateTime.parse(i.dateIso).toInstant();
                    } catch (Exception e) {
                        try {
                            return java.time.LocalDateTime.parse(i.dateIso).atZone(java.time.ZoneId.systemDefault()).toInstant();
                        } catch (Exception ex) {
                            return java.time.Instant.MIN;
                        }
                    }
                }).reversed())
                .collect(Collectors.toList());

        return ResponseEntity.ok(sorted);
    }

    private boolean isSuperAdmin(Utilisateur user) {
        if (user == null) return false;
        // Determine superadmin by role membership only
        return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()));
    }
}
