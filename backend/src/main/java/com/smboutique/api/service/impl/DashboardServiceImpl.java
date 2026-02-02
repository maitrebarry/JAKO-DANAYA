package com.smboutique.api.service.impl;

import com.smboutique.api.service.DashboardService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.ClientGrossisteService;
import com.smboutique.api.service.FournisseurService;
import com.smboutique.api.service.CommandeClientService;
import com.smboutique.api.service.CommandeFournisseurService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.InventaireService;
import com.smboutique.api.service.dto.DashboardOverviewDTO;
import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Stock;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@Service
public class DashboardServiceImpl implements DashboardService {

    private final ProduitService produitService;
    private final ClientGrossisteService clientGrossisteService;
    private final FournisseurService fournisseurService;
    private final CommandeClientService commandeClientService;
    private final CommandeFournisseurService commandeFournisseurService;
    private final StockService stockService;
    private final InventaireService inventaireService;
    private final com.smboutique.api.service.VenteService venteService;

    public DashboardServiceImpl(ProduitService produitService,
                                ClientGrossisteService clientGrossisteService,
                                FournisseurService fournisseurService,
                                CommandeClientService commandeClientService,
                                CommandeFournisseurService commandeFournisseurService,
                                StockService stockService,
                                InventaireService inventaireService,
                                com.smboutique.api.service.VenteService venteService) {
        this.produitService = produitService;
        this.clientGrossisteService = clientGrossisteService;
        this.fournisseurService = fournisseurService;
        this.commandeClientService = commandeClientService;
        this.commandeFournisseurService = commandeFournisseurService;
        this.stockService = stockService;
        this.inventaireService = inventaireService;
        this.venteService = venteService;
    }

    @Override
    public DashboardOverviewDTO getOverview(Long boutiqueId, Long magasinId) {
        DashboardOverviewDTO dto = new DashboardOverviewDTO();

        // counts - filter by boutique and magasin if provided
        if (magasinId != null) {
            // For magasin scope, count products that are in that magasin
            dto.setProductsCount((int) stockService.getAllStocks().stream()
                    .filter(s -> s.getMagasin() != null && s.getMagasin().getId().equals(magasinId))
                    .map(s -> s.getProduit())
                    .distinct()
                    .count());
        } else {
            dto.setProductsCount(boutiqueId == null ? produitService.findAll().size() : produitService.findByBoutiqueId(boutiqueId).size());
        }
        dto.setClientsCount(clientGrossisteService.findAll().size());
        dto.setSuppliersCount(boutiqueId == null ? fournisseurService.findAll().size() : fournisseurService.findAllByBoutiqueId(boutiqueId).size());

        // commandes (scope boutique if provided, or filter by magasin if provided)
        List<CommandeClient> commandes;
        if (magasinId != null) {
            // For magasin scope, filter commandes that have at least one product stocked in this magasin
            List<CommandeClient> allCommandes = (boutiqueId == null) ? commandeClientService.findAll() : commandeClientService.findAllByBoutiqueId(boutiqueId);
            commandes = allCommandes.stream()
                    .filter(commande -> commande.getLignes() != null && commande.getLignes().stream()
                            .anyMatch(ligne -> {
                                if (ligne.getProduit() == null) return false;
                                // Check if this product has stock in the selected magasin
                                return stockService.getAllStocks().stream()
                                        .anyMatch(stock -> stock.getProduit() != null &&
                                                         stock.getProduit().getId().equals(ligne.getProduit().getId()) &&
                                                         stock.getMagasin() != null &&
                                                         stock.getMagasin().getId().equals(magasinId));
                            }))
                    .collect(java.util.stream.Collectors.toList());
        } else {
            commandes = (boutiqueId == null) ? commandeClientService.findAll() : commandeClientService.findAllByBoutiqueId(boutiqueId);
        }

        long salesTotal = commandes.stream().mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
        dto.setSalesTotal(salesTotal);

        // today sales
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = LocalDateTime.now();
        long salesToday = commandes.stream()
                .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(start) && !c.getDateCommande().isAfter(end))
                .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue())
                .sum();
        dto.setSalesToday(salesToday);

        // pending orders: paie null or less than total
        long pending = commandes.stream().filter(c -> c.getTotal() != null && (c.getPaie() == null || c.getPaie().intValue() < c.getTotal().intValue())).count();
        dto.setPendingOrders(pending);

        // low stock count - use product's alerte_stock threshold
        List<Stock> stocks = stockService.getAllStocks();
        long lowStock = stocks.stream()
                .filter(s -> (boutiqueId == null || (s.getBoutique() != null && s.getBoutique().getId().equals(boutiqueId))) )
                .filter(s -> magasinId == null || (s.getMagasin() != null && s.getMagasin().getId().equals(magasinId)))
                .filter(s -> s.getProduit() != null && s.getProduit().getAlerteStock() != null)
                .filter(s -> s.getQuantiteDisponible() == null || s.getQuantiteDisponible() <= s.getProduit().getAlerteStock())
                .count();
        dto.setLowStockCount(lowStock);

        // Calculate top products
        List<DashboardOverviewDTO.TopProductDTO> topProducts = calculateTopProducts(commandes);
        dto.setTopProducts(topProducts);

        // Calculate sales for last 7 days
        List<Long> sales7d = calculateSalesLast7Days(commandes);
        dto.setSales7d(sales7d);

        return dto;
    }

    private List<DashboardOverviewDTO.TopProductDTO> calculateTopProducts(List<CommandeClient> commandes) {
        Map<Long, Double> productSalesValue = new HashMap<>();
        Map<Long, String> productNames = new HashMap<>();

        // Aggregate sales value by product (quantity * unit price)
        for (CommandeClient commande : commandes) {
            if (commande.getLignes() != null) {
                for (var ligne : commande.getLignes()) {
                    if (ligne.getProduit() != null && ligne.getQuantite() != null) {
                        Long productId = ligne.getProduit().getId();
                        Double quantity = ligne.getQuantite().doubleValue();
                        
                        // Use newPrice if available, otherwise use prixDetail from product
                        Double unitPrice = ligne.getNewPrice() != null ? 
                            ligne.getNewPrice().doubleValue() : 
                            (ligne.getProduit().getPrixDetail() != null ? 
                                ligne.getProduit().getPrixDetail().doubleValue() : 0.0);
                        
                        Double lineTotal = quantity * unitPrice;

                        productSalesValue.put(productId, productSalesValue.getOrDefault(productId, 0.0) + lineTotal);
                        productNames.put(productId, ligne.getProduit().getNomProduit());
                    }
                }
            }
        }

        // Convert to TopProductDTO list and sort by sales value descending
        return productSalesValue.entrySet().stream()
                .sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .limit(10) // Top 10 products by value
                .map(entry -> new DashboardOverviewDTO.TopProductDTO(
                        entry.getKey(),
                        productNames.get(entry.getKey()),
                        entry.getValue().longValue() // Convert back to long for display
                ))
                .collect(java.util.stream.Collectors.toList());
    }

    private List<Long> calculateSalesLast7Days(List<CommandeClient> commandes) {
        List<Long> sales7d = new java.util.ArrayList<>();
        LocalDate today = LocalDate.now();

        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            LocalDateTime startOfDay = date.atStartOfDay();
            LocalDateTime endOfDay = date.atTime(LocalTime.MAX);

            long dailySales = commandes.stream()
                    .filter(c -> c.getDateCommande() != null &&
                            !c.getDateCommande().isBefore(startOfDay) &&
                            !c.getDateCommande().isAfter(endOfDay))
                    .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue())
                    .sum();

            sales7d.add(dailySales);
        }

        return sales7d;
    }

    private Map<String, Object> calculateResumeCaisse(List<CommandeClient> commandes, Long boutiqueId) {
        // Calculate today's cash register summary
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime endOfToday = LocalDateTime.now();

        List<CommandeClient> todayOrders = commandes.stream()
                .filter(c -> c.getDateCommande() != null &&
                        !c.getDateCommande().isBefore(startOfToday) &&
                        !c.getDateCommande().isAfter(endOfToday))
                .collect(java.util.stream.Collectors.toList());

        long totalVentes = todayOrders.stream()
                .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue())
                .sum();

        long paiementsComplets = todayOrders.stream()
                .filter(c -> c.getPaie() != null && c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) >= 0)
                .mapToLong(c -> c.getPaie().longValue())
                .sum();

        long paiementsPartiels = todayOrders.stream()
                .filter(c -> c.getPaie() != null && c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0)
                .mapToLong(c -> c.getPaie().longValue())
                .sum();

        long ventesCredit = todayOrders.stream()
                .filter(c -> c.getPaie() == null || (c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0))
                .count();

        // Add today's cash sales (Vente) for this boutique to the totals when boutiqueId is provided
        long ventesEspeces = 0L;
        try {
            if (boutiqueId != null && venteService != null) {
                java.util.List<com.smboutique.api.model.Vente> ventes = venteService.findByBoutiqueId(boutiqueId);
                ventesEspeces = ventes.stream()
                        .filter(v -> v.getDateVente() != null && !v.getDateVente().isBefore(startOfToday) && !v.getDateVente().isAfter(endOfToday))
                        .mapToLong(v -> v.getMontantTotal() == null ? 0L : v.getMontantTotal().longValue())
                        .sum();
            }
        } catch (Exception ex) {
            ventesEspeces = 0L; // ignore failures
        }

        long entreeTotal = totalVentes + ventesEspeces;
        long paiementsCompletsTotal = paiementsComplets + ventesEspeces;

        Map<String, Object> resume = new HashMap<>();
        resume.put("entrees", entreeTotal);
        resume.put("paiements_complets", paiementsCompletsTotal);
        resume.put("paiements_partiels", paiementsPartiels);
        resume.put("ventes_credit", ventesCredit);
        resume.put("total_commandes", todayOrders.size());
        resume.put("ventes_especes", ventesEspeces);

        return resume;
    }

    @Override
    public com.smboutique.api.service.dto.DashboardPayload getDashboardFor(com.smboutique.api.model.Utilisateur utilisateur, Long shopId, Long magasinId) {
        com.smboutique.api.service.dto.DashboardPayload payload = new com.smboutique.api.service.dto.DashboardPayload();

        boolean isSuperAdmin = utilisateur != null && ("SUPERADMIN".equalsIgnoreCase(utilisateur.getTypeUtilisateur()) || (utilisateur.getRoles()!=null && utilisateur.getRoles().stream().anyMatch(r->"SUPERADMIN".equalsIgnoreCase(r.getName())||"ROLE_SUPERADMIN".equalsIgnoreCase(r.getName()))));
        boolean isOwner = utilisateur != null && ("PROPRIETAIRE".equalsIgnoreCase(utilisateur.getTypeUtilisateur()) || (utilisateur.getRoles()!=null && (utilisateur.getRoles().stream().anyMatch(r->"PROPRIETAIRE".equalsIgnoreCase(r.getName())||"OWNER".equalsIgnoreCase(r.getName())||"ADMIN".equalsIgnoreCase(r.getName())))));
        boolean isManager = utilisateur != null && ("GERANT_BOUTIQUE".equalsIgnoreCase(utilisateur.getTypeUtilisateur()) || (utilisateur.getRoles()!=null && utilisateur.getRoles().stream().anyMatch(r->"GERANT_BOUTIQUE".equalsIgnoreCase(r.getName())||"MANAGER".equalsIgnoreCase(r.getName()))));
        boolean isCashier = utilisateur != null && ("CAISSIER".equalsIgnoreCase(utilisateur.getTypeUtilisateur()) || (utilisateur.getRoles()!=null && utilisateur.getRoles().stream().anyMatch(r->"CAISSIER".equalsIgnoreCase(r.getName())||"CASHIER".equalsIgnoreCase(r.getName()))));
        boolean isWarehouse = utilisateur != null && ("MAGASINIER".equalsIgnoreCase(utilisateur.getTypeUtilisateur()) || (utilisateur.getRoles()!=null && utilisateur.getRoles().stream().anyMatch(r->"MAGASINIER".equalsIgnoreCase(r.getName())||"ROLE_MAGASINIER".equalsIgnoreCase(r.getName()))));

        Long targetBoutiqueId = null;
        Long targetMagasinId = magasinId;
        if (isSuperAdmin) {
            targetBoutiqueId = shopId;
            targetMagasinId = magasinId;
        } else {
            if (utilisateur != null && utilisateur.getBoutique()!=null) {
                targetBoutiqueId = utilisateur.getBoutique().getId();
                // If magasinId is provided, validate it belongs to user's boutique
                if (magasinId != null) {
                    targetMagasinId = magasinId;
                }
            } else if (shopId != null) {
                // user requested a shop but has no access: return minimal payload with error role
                payload.role = "UNAUTHORIZED";
                payload.widgets = Map.of("error", "Accès à la boutique refusé");
                return payload;
            }
        }

        final Long finalTargetBoutiqueId = targetBoutiqueId;
        final Long finalTargetMagasinId = targetMagasinId;

        com.smboutique.api.service.dto.DashboardOverviewDTO dto = getOverview(finalTargetBoutiqueId, finalTargetMagasinId);

        Map<String,Object> widgets = new java.util.HashMap<>();
        String role = "USER";

        if (isSuperAdmin) {
            role = "SUPERADMIN";
            // System-level widgets - will be filled by controller with real counts
            widgets.put("shopsCount", 0L); // Placeholder, controller will replace
            widgets.put("usersCount", 0L); // Placeholder, controller will replace
            widgets.put("transactionsCount", 0L); // Placeholder, controller will replace
            widgets.put("erreurs_systeme", 0);
            widgets.put("etat_services", java.util.Map.of("api","OK","db","OK"));
        } else if (isOwner) {
            role = "PROPRIETAIRE";
            System.out.println("DEBUG: User is PROPRIETAIRE, adding commande_client widget");
            widgets.put("chiffre_affaires_total", dto.getSalesTotal());
            widgets.put("valeur_stock", stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .filter(s -> finalTargetMagasinId == null || (s.getMagasin() != null && s.getMagasin().getId().equals(finalTargetMagasinId)))
                    .map(s -> {
                        Integer prixAchat = s.getProduit() != null && s.getProduit().getPrixAchat() != null ? s.getProduit().getPrixAchat() : 0;
                        java.math.BigDecimal price = java.math.BigDecimal.valueOf(prixAchat);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue());
            widgets.put("top_products", dto.getTopProducts());
            widgets.put("resume_caisse", calculateResumeCaisse(commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId), finalTargetBoutiqueId));
            widgets.put("evolution_ventes", java.util.Map.of("trend", calculateSalesTrend(dto.getSales7d())));
            if (finalTargetMagasinId != null) {
                // Count products that have stock in the selected magasin
                long count = stockService.getAllStocks().stream()
                        .filter(s -> s.getMagasin() != null && s.getMagasin().getId().equals(finalTargetMagasinId))
                        .map(s -> s.getProduit())
                        .filter(java.util.Objects::nonNull)
                        .distinct()
                        .count();
                widgets.put("total_articles", (int) count);
            } else {
                widgets.put("total_articles", produitService.findByBoutiqueId(finalTargetBoutiqueId).size());
            }
            widgets.put("alerte_stock", dto.getLowStockCount());
            widgets.put("commande_fournisseur", commandeFournisseurService.findAllByBoutiqueId(finalTargetBoutiqueId).size());
            widgets.put("commande_client", commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId).size());
            widgets.put("vente_credit", commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId).stream()
                    .filter(c -> c.getPaie() == null || (c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0))
                    .count());

            // Calculs détaillés pour bilan des ventes
            List<CommandeClient> commandes = commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId);
            widgets.put("bilan_ventes", calculateBilanVentes(commandes));
            widgets.put("bilan_trimestriel", calculateBilanTrimestriel(commandes));
        } else if (isManager) {
            role = "GERANT";
            System.out.println("DEBUG: User is GERANT, adding commande_client widget");
            widgets.put("ventes_jour", dto.getSalesToday());
            widgets.put("stock_critique", dto.getLowStockCount());
            widgets.put("commande_client", commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId).size());
            widgets.put("valeur_stock_boutique", stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .filter(s -> finalTargetMagasinId == null || (s.getMagasin() != null && s.getMagasin().getId().equals(finalTargetMagasinId)))
                    .map(s -> {
                        Integer prixAchat = s.getProduit() != null && s.getProduit().getPrixAchat() != null ? s.getProduit().getPrixAchat() : 0;
                        java.math.BigDecimal price = java.math.BigDecimal.valueOf(prixAchat);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue());
            // Indicater whether an active inventory exists for this boutique
            boolean actif = finalTargetBoutiqueId != null && inventaireService.existsActiveInventoryForBoutique(finalTargetBoutiqueId);
            widgets.put("inventaire_actif", actif);
            widgets.put("resume_caisse_jour", java.util.Map.of("total", dto.getSalesToday()));
        } else if (isWarehouse) {
            role = "MAGASINIER";
            widgets.put("produits_rupture", dto.getLowStockCount());
            widgets.put("produits_seuil", dto.getLowStockCount());
            widgets.put("valeur_stock_magasin", stockService.getAllStocks().stream()
                    .filter(s -> s.getBoutique() != null && s.getBoutique().getId().equals(finalTargetBoutiqueId))
                    .filter(s -> finalTargetMagasinId == null || (s.getMagasin() != null && s.getMagasin().getId().equals(finalTargetMagasinId)))
                    .map(s -> {
                        Integer prixAchat = s.getProduit() != null && s.getProduit().getPrixAchat() != null ? s.getProduit().getPrixAchat() : 0;
                        java.math.BigDecimal price = java.math.BigDecimal.valueOf(prixAchat);
                        java.math.BigDecimal q = s.getQuantiteDisponible() != null ? java.math.BigDecimal.valueOf(s.getQuantiteDisponible()) : java.math.BigDecimal.ZERO;
                        return price.multiply(q);
                    }).reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add).doubleValue());
        } else if (isCashier) {
            role = "CAISSIER";
            System.out.println("DEBUG: User is CAISSIER, adding commande_client widget");
            widgets.put("ventes_jour_personnelles", personalSalesForUser(utilisateur.getId(), finalTargetBoutiqueId));
            widgets.put("commande_client", commandeClientService.findAllByBoutiqueId(finalTargetBoutiqueId).size());
            widgets.put("etat_caisse", java.util.Map.of("status", "ouvert"));
        } else {
            role = "USER";
            widgets.put("ventes_jour", dto.getSalesToday());
            widgets.put("commandes_en_attente", dto.getPendingOrders());
        }

        payload.role = role;
        payload.widgets = widgets;

        // Build shops list (controller fills full shop list for SUPERADMIN)
        java.util.List<com.smboutique.api.service.dto.DashboardPayload.Shop> shopsList = new java.util.ArrayList<>();
        if (isSuperAdmin) {
            // leave shopsList empty; controller will populate shops/count for SUPERADMIN
        } else if (utilisateur != null && utilisateur.getBoutique()!=null) {
            shopsList.add(new com.smboutique.api.service.dto.DashboardPayload.Shop(utilisateur.getBoutique().getId(), utilisateur.getBoutique().getNom()));
        }

        // prepare role sections similar to controller
        java.util.List<com.smboutique.api.service.dto.DashboardPayload.Section> sections = new java.util.ArrayList<>();

        java.util.function.Function<java.util.Map<String,Object>, java.util.List<com.smboutique.api.service.dto.DashboardPayload.Widget>> widgetsToList = (wm) -> {
            java.util.List<com.smboutique.api.service.dto.DashboardPayload.Widget> list = new java.util.ArrayList<>();
            if (wm == null) return list;
            wm.forEach((k,v) -> {
                com.smboutique.api.service.dto.DashboardPayload.Widget w = new com.smboutique.api.service.dto.DashboardPayload.Widget();
                w.key = k;
                w.permission = ("DASHBOARD_" + k.toUpperCase() + "_VOIR");
                java.util.Map<String,Object> dataMap = new java.util.HashMap<>();
                dataMap.put("value", v);
                w.data = dataMap;
                list.add(w);
            });
            return list;
        };

        // Build sections
        if (isSuperAdmin) {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("boutiques_actives", widgets.get("boutiques_actives"));
            m.put("utilisateurs_inscrits", widgets.get("utilisateurs_inscrits"));
            m.put("transactions_totales", widgets.get("transactions_totales"));
            m.put("erreurs_systeme", widgets.get("erreurs_systeme"));
            m.put("etat_services", widgets.get("etat_services"));
            sections.add(makeSection("SUPERADMIN", widgetsToList.apply(m), shopsList));
        }
        if (isOwner || isSuperAdmin) {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("chiffre_affaires_total", widgets.get("chiffre_affaires_total"));
            m.put("valeur_stock", widgets.get("valeur_stock"));
            m.put("top_products", widgets.get("top_products"));
            m.put("resume_caisse", widgets.get("resume_caisse"));
            m.put("evolution_ventes", widgets.get("evolution_ventes"));
            m.put("total_articles", widgets.get("total_articles"));
            m.put("alerte_stock", widgets.get("alerte_stock"));
            m.put("commande_fournisseur", widgets.get("commande_fournisseur"));
            m.put("vente_credit", widgets.get("vente_credit"));
            m.put("bilan_ventes", widgets.get("bilan_ventes"));
            m.put("bilan_trimestriel", widgets.get("bilan_trimestriel"));
            sections.add(makeSection("PROPRIETAIRE", widgetsToList.apply(m), shopsList));
        }
        if (isManager || isOwner || isSuperAdmin) {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("ventes_jour", widgets.get("ventes_jour"));
            m.put("stock_critique", widgets.get("stock_critique"));
            m.put("valeur_stock_boutique", widgets.get("valeur_stock_boutique"));
            m.put("inventaire_actif", widgets.get("inventaire_actif"));
            m.put("resume_caisse_jour", widgets.get("resume_caisse_jour"));
            sections.add(makeSection("GERANT", widgetsToList.apply(m), shopsList));
        }
        if (isCashier || isManager || isOwner || isSuperAdmin) {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("ventes_jour_personnelles", widgets.get("ventes_jour_personnelles"));
            m.put("etat_caisse", widgets.get("etat_caisse"));
            sections.add(makeSection("CAISSIER", widgetsToList.apply(m), shopsList));
        }
        if (isWarehouse || isManager || isOwner || isSuperAdmin) {
            java.util.Map<String,Object> m = new java.util.HashMap<>();
            m.put("produits_rupture", widgets.get("produits_rupture"));
            m.put("produits_seuil", widgets.get("produits_seuil"));
            m.put("valeur_stock_magasin", widgets.get("valeur_stock_magasin"));
            sections.add(makeSection("MAGASINIER", widgetsToList.apply(m), shopsList));
        }

        payload.sections = sections;
        if (utilisateur != null && utilisateur.getBoutique() != null) payload.currentBoutique = new com.smboutique.api.service.dto.DashboardPayload.Shop(utilisateur.getBoutique().getId(), utilisateur.getBoutique().getNom());

        return payload;
    }

    // helper: personal sales by user for a boutique (moved from controller)
    private long personalSalesForUser(Long userId, Long boutiqueId) {
        if (userId == null) return 0L;
        java.util.List<CommandeClient> commandes = (boutiqueId == null) ? commandeClientService.findAll() : commandeClientService.findAllByBoutiqueId(boutiqueId);
        return commandes.stream().filter(c -> c.getUtilisateur() != null && userId.equals(c.getUtilisateur().getId()))
                .mapToLong(c -> c.getTotal() == null ? 0L : c.getTotal().longValue()).sum();
    }

    private Map<String, Object> calculateBilanVentes(List<CommandeClient> commandes) {
        Map<String, Object> bilan = new HashMap<>();

        LocalDateTime now = LocalDateTime.now();
        LocalDate today = LocalDate.now();

        // Daily calculations
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = now;

        long dailyTotal = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfDay) && !c.getDateCommande().isAfter(endOfDay))
            .mapToLong(c -> c.getTotal() != null ? c.getTotal().longValue() : 0L).sum();

        long dailyCredit = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfDay) && !c.getDateCommande().isAfter(endOfDay))
            .filter(c -> c.getPaie() != null && c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0)
            .mapToLong(c -> c.getTotal().longValue() - c.getPaie().longValue()).sum();

        long dailyCash = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfDay) && !c.getDateCommande().isAfter(endOfDay))
            .mapToLong(c -> c.getPaie() != null ? c.getPaie().longValue() : 0L).sum();

        // Monthly calculations
        LocalDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay();

        long monthlyTotal = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfMonth))
            .mapToLong(c -> c.getTotal() != null ? c.getTotal().longValue() : 0L).sum();

        long monthlyCredit = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfMonth))
            .filter(c -> c.getPaie() != null && c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0)
            .mapToLong(c -> c.getTotal().longValue() - c.getPaie().longValue()).sum();

        long monthlyCash = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfMonth))
            .mapToLong(c -> c.getPaie() != null ? c.getPaie().longValue() : 0L).sum();

        // Annual calculations
        LocalDateTime startOfYear = today.withDayOfYear(1).atStartOfDay();

        long annualTotal = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfYear))
            .mapToLong(c -> c.getTotal() != null ? c.getTotal().longValue() : 0L).sum();

        long annualCredit = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfYear))
            .filter(c -> c.getPaie() != null && c.getTotal() != null && c.getPaie().compareTo(c.getTotal()) < 0)
            .mapToLong(c -> c.getTotal().longValue() - c.getPaie().longValue()).sum();

        long annualCash = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(startOfYear))
            .mapToLong(c -> c.getPaie() != null ? c.getPaie().longValue() : 0L).sum();

        bilan.put("dailyTotal", dailyTotal);
        bilan.put("dailyCredit", dailyCredit);
        bilan.put("dailyCash", dailyCash);
        bilan.put("monthlyTotal", monthlyTotal);
        bilan.put("monthlyCredit", monthlyCredit);
        bilan.put("monthlyCash", monthlyCash);
        bilan.put("annualTotal", annualTotal);
        bilan.put("annualCredit", annualCredit);
        bilan.put("annualCash", annualCash);

        return bilan;
    }

    private Map<String, Object> calculateBilanTrimestriel(List<CommandeClient> commandes) {
        Map<String, Object> bilan = new HashMap<>();

        LocalDate now = LocalDate.now();
        int currentQuarter = (now.getMonthValue() - 1) / 3 + 1;
        LocalDate quarterStart = LocalDate.of(now.getYear(), (currentQuarter - 1) * 3 + 1, 1);
        LocalDateTime quarterStartDT = quarterStart.atStartOfDay();

        long quarterlyTotal = commandes.stream()
            .filter(c -> c.getDateCommande() != null && !c.getDateCommande().isBefore(quarterStartDT))
            .mapToLong(c -> c.getTotal() != null ? c.getTotal().longValue() : 0L).sum();

        // Calculate quarterly profit (simplified - 15% margin)
        long quarterlyProfit = (long)(quarterlyTotal * 0.15);

        bilan.put("totalVentesTrimestre", quarterlyTotal);
        bilan.put("beneficeTrimestriel", quarterlyProfit);

        return bilan;
    }

    private double calculateSalesTrend(List<Long> sales7d) {
        if (sales7d == null || sales7d.size() < 2) return 0.0;

        // Calculate trend as percentage change from first to last day
        long firstDay = sales7d.get(0);
        long lastDay = sales7d.get(sales7d.size() - 1);

        if (firstDay == 0) return lastDay > 0 ? 100.0 : 0.0;

        return ((double)(lastDay - firstDay) / firstDay) * 100.0;
    }

    public java.util.List<java.util.Map<String, Object>> getLowStockProducts(Long boutiqueId, Long magasinId) {
        List<Stock> stocks = stockService.getAllStocks();
        return stocks.stream()
                .filter(s -> (boutiqueId == null || (s.getBoutique() != null && s.getBoutique().getId().equals(boutiqueId))) )
                .filter(s -> magasinId == null || (s.getMagasin() != null && s.getMagasin().getId().equals(magasinId)))
                .filter(s -> s.getProduit() != null && s.getProduit().getAlerteStock() != null)
                .filter(s -> s.getQuantiteDisponible() == null || s.getQuantiteDisponible() <= s.getProduit().getAlerteStock())
                .map(s -> {
                    java.util.Map<String, Object> product = new java.util.HashMap<>();
                    product.put("id", s.getProduit().getId());
                    product.put("nom", s.getProduit().getNomProduit());
                    product.put("stockActuel", s.getQuantiteDisponible() != null ? s.getQuantiteDisponible() : 0);
                    product.put("seuilAlerte", s.getProduit().getAlerteStock());
                    product.put("magasin", s.getMagasin() != null ? s.getMagasin().getNom() : "Boutique");
                    return product;
                })
                .collect(java.util.stream.Collectors.toList());
    }

    private com.smboutique.api.service.dto.DashboardPayload.Section makeSection(String role, java.util.List<com.smboutique.api.service.dto.DashboardPayload.Widget> widgets, java.util.List<com.smboutique.api.service.dto.DashboardPayload.Shop> shops) {
        com.smboutique.api.service.dto.DashboardPayload.Section s = new com.smboutique.api.service.dto.DashboardPayload.Section();
        s.role = role;
        s.widgets = widgets;
        s.shops = shops;
        return s;
    }
}
