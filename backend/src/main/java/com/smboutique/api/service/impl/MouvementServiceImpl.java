package com.smboutique.api.service.impl;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.model.Magasin;
import com.smboutique.api.repository.MouvementRepository;
import com.smboutique.api.repository.StockRepository;
import com.smboutique.api.service.MouvementService;
import com.smboutique.api.service.ProduitService;
import com.smboutique.api.service.StockService;
import com.smboutique.api.service.MagasinService;
import com.smboutique.api.service.BoutiqueService;
import com.smboutique.api.service.UtilisateurService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.smboutique.api.service.MouvementSearchResult;

@Service
public class MouvementServiceImpl implements MouvementService {

    private static final Logger log = LoggerFactory.getLogger(MouvementServiceImpl.class);

    @Autowired
    private MouvementRepository mouvementRepository;

    @Autowired
    private ProduitService produitService;

    @Autowired
    private StockService stockService;

    @Autowired
    private StockRepository stockRepository;

    @Autowired
    private MagasinService magasinService;

    @Autowired
    private BoutiqueService boutiqueService;

    @Autowired
    private UtilisateurService utilisateurService;

    @Autowired
    private com.smboutique.api.service.UtilisationPertesService utilisationPertesService;

    @PersistenceContext
    private EntityManager em;

    @Override
    public List<Mouvement> findAll() {
        return mouvementRepository.findAll();
    }

    @Override
    public Optional<Mouvement> findById(Long id) {
        return mouvementRepository.findById(id);
    }

    @Override
    public Mouvement save(Mouvement mouvement) {
        return mouvementRepository.save(mouvement);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void deleteById(Long id) {
        java.util.Optional<Mouvement> opt = mouvementRepository.findById(id);
        if (opt.isPresent()) {
            Mouvement m = opt.get();
            // If this was a utilisation/perte, restore the quantity to the associated stock
            if ("UTILISATION".equalsIgnoreCase(m.getTypeMouvement()) && m.getStock() != null && m.getQuantite() != null) {
                try {
                    Stock s = m.getStock();
                    if (s.getId() != null) {
                        s = stockRepository.findByIdForUpdate(s.getId()).orElse(s);
                    }
                    Integer qDisp = s.getQuantiteDisponible() == null ? 0 : s.getQuantiteDisponible();
                    s.setQuantiteDisponible(qDisp + m.getQuantite());
                    stockService.saveStock(s);
                } catch (Exception ex) {
                    log.warn("Failed to restore stock for mouvement id {}: {}", id, ex.getMessage());
                }
            }
            mouvementRepository.deleteById(id);
        }
    }

    @Override
    public List<Mouvement> search(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, java.time.LocalDateTime from, java.time.LocalDateTime to) {
        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Mouvement> cq = cb.createQuery(Mouvement.class);
        Root<Mouvement> root = cq.from(Mouvement.class);

        List<Predicate> predicates = new ArrayList<>();

        if (userId != null) {
            predicates.add(cb.equal(root.get("utilisateur").get("id"), userId));
        }
        if (type != null && !type.isEmpty()) {
            predicates.add(cb.equal(root.get("typeMouvement"), type));
        }
        if (sousType != null && !sousType.isEmpty()) {
            predicates.add(cb.equal(root.get("sousType"), sousType));
        }
        if (boutiqueId != null) {
            predicates.add(cb.equal(root.get("boutique").get("id"), boutiqueId));
        }
        if (magasinId != null) {
            predicates.add(cb.equal(root.get("magasin").get("id"), magasinId));
        }
        if (referenceId != null) {
            predicates.add(cb.equal(root.get("referenceId"), referenceId));
        }
        if (from != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("dateMouvement"), from));
        }
        if (to != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("dateMouvement"), to));
        }

        cq.where(predicates.toArray(new Predicate[0]));
        cq.orderBy(cb.desc(root.get("dateMouvement")));
        return em.createQuery(cq).getResultList();
    }

    @Override
    public MouvementSearchResult searchPage(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, java.time.LocalDateTime from, java.time.LocalDateTime to, int page, int size) {
        if (page < 1) page = 1;
        if (size <= 0) size = 25;

        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Mouvement> cq = cb.createQuery(Mouvement.class);
        Root<Mouvement> root = cq.from(Mouvement.class);

        List<Predicate> predicates = new ArrayList<>();

        if (userId != null) {
            predicates.add(cb.equal(root.get("utilisateur").get("id"), userId));
        }
        if (type != null && !type.isEmpty()) {
            predicates.add(cb.equal(root.get("typeMouvement"), type));
        }
        if (sousType != null && !sousType.isEmpty()) {
            predicates.add(cb.equal(root.get("sousType"), sousType));
        }
        if (boutiqueId != null) {
            predicates.add(cb.equal(root.get("boutique").get("id"), boutiqueId));
        }
        if (magasinId != null) {
            predicates.add(cb.equal(root.get("magasin").get("id"), magasinId));
        }
        if (referenceId != null) {
            predicates.add(cb.equal(root.get("referenceId"), referenceId));
        }
        if (from != null) {
            predicates.add(cb.greaterThanOrEqualTo(root.get("dateMouvement"), from));
        }
        if (to != null) {
            predicates.add(cb.lessThanOrEqualTo(root.get("dateMouvement"), to));
        }

        cq.where(predicates.toArray(new Predicate[0]));
        cq.orderBy(cb.desc(root.get("dateMouvement")));

        // count
        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<Mouvement> countRoot = countQuery.from(Mouvement.class);
        countQuery.select(cb.count(countRoot));
        List<Predicate> countPreds = new ArrayList<>();
        for (Predicate p : predicates) {
            // rebuild predicates using countRoot by comparing the same attributes
            // note: can't reuse predicate instances bound to different roots; recreate
            // We'll recreate the same conditions manually
        }
        // Recreate predicates for count query
        if (userId != null) countPreds.add(cb.equal(countRoot.get("utilisateur").get("id"), userId));
        if (type != null && !type.isEmpty()) countPreds.add(cb.equal(countRoot.get("typeMouvement"), type));
        if (sousType != null && !sousType.isEmpty()) countPreds.add(cb.equal(countRoot.get("sousType"), sousType));
        if (boutiqueId != null) countPreds.add(cb.equal(countRoot.get("boutique").get("id"), boutiqueId));
        if (magasinId != null) countPreds.add(cb.equal(countRoot.get("magasin").get("id"), magasinId));
        if (referenceId != null) countPreds.add(cb.equal(countRoot.get("referenceId"), referenceId));
        if (from != null) countPreds.add(cb.greaterThanOrEqualTo(countRoot.get("dateMouvement"), from));
        if (to != null) countPreds.add(cb.lessThanOrEqualTo(countRoot.get("dateMouvement"), to));

        countQuery.where(countPreds.toArray(new Predicate[0]));
        Long total = em.createQuery(countQuery).getSingleResult();

        int offset = (page - 1) * size;
        List<Mouvement> items = em.createQuery(cq).setFirstResult(offset).setMaxResults(size).getResultList();
        return new MouvementSearchResult(items, total != null ? total.longValue() : 0L);
    }

    @Override
    public void log(String type, String sousType, String description, Long referenceId, Long boutiqueId, Long magasinId, Long utilisateurId, Double montant) {
        Mouvement mv = new Mouvement();
        mv.setTypeMouvement(type);
        mv.setSousType(sousType);
        mv.setDescription(description);
        mv.setReferenceId(referenceId);
        if (boutiqueId != null) {
            mv.setBoutique(em.getReference(com.smboutique.api.model.Boutique.class, boutiqueId));
        }
        if (magasinId != null) {
            mv.setMagasin(em.getReference(com.smboutique.api.model.Magasin.class, magasinId));
        }
        if (utilisateurId != null) {
            mv.setUtilisateur(em.getReference(com.smboutique.api.model.Utilisateur.class, utilisateurId));
        }
        if (montant != null) {
            mv.setMontant(montant.intValue());
        }
        mv.setDateMouvement(java.time.LocalDateTime.now());
        mouvementRepository.save(mv);
    }

    @Override
    public com.smboutique.api.service.dto.CaisseSummaryResult summarizeCaisse(String period, Long userId, Long boutiqueId, Long magasinId, java.time.LocalDateTime from, java.time.LocalDateTime to) {
        // Determine deviseSymbole
        String deviseSymbole = null;
        if (boutiqueId != null) {
            com.smboutique.api.model.Boutique boutique = boutiqueService.findById(boutiqueId).orElse(null);
            if (boutique != null && boutique.getPays() != null) {
                deviseSymbole = boutique.getPays().getDeviseSymbole();
            }
        } else if (userId != null) {
            com.smboutique.api.model.Utilisateur user = utilisateurService.findById(userId).orElse(null);
            if (user != null && user.getBoutique() != null && user.getBoutique().getPays() != null) {
                deviseSymbole = user.getBoutique().getPays().getDeviseSymbole();
            }
        }

        // Build DB-friendly label expression based on the requested period (day|month|year)
        String periodParam = period == null ? "day" : period.toLowerCase();
        String labelExpr;
        switch (periodParam) {
            case "month":
                // YYYY-MM -> use to_char for Postgres compatibility
                labelExpr = "to_char(date_mov, 'YYYY-MM')";
                break;
            case "year":
                // YYYY
                labelExpr = "to_char(date_mov, 'YYYY')";
                break;
            default:
                // date only
                labelExpr = "DATE(date_mov)";
                break;
        }

        StringBuilder sql = new StringBuilder();
        sql.append("select ").append(labelExpr).append(" as period, ")
                .append("sum(case when montant > 0 then montant else 0 end) as total_entrees, ")
                .append("sum(case when montant < 0 then -montant else 0 end) as total_sorties ")
                .append("from mouvement where montant is not null ");

        java.util.List<String> conditions = new java.util.ArrayList<>();
        if (userId != null) conditions.add("id_utilisateur = :userId");
        if (boutiqueId != null) conditions.add("id_boutique = :boutiqueId");
        if (magasinId != null) conditions.add("id_magasin = :magasinId");
        if (from != null) conditions.add("date_mov >= :from");
        if (to != null) conditions.add("date_mov <= :to");

        if (!conditions.isEmpty()) {
            sql.append("and ").append(String.join(" and ", conditions)).append(" ");
        }

        sql.append("group by ").append(labelExpr).append(" order by period desc");

        log.debug("SummarizeCaisse SQL: {}", sql.toString());
        log.debug("SummarizeCaisse params: userId={}, boutiqueId={}, magasinId={}, from={}, to={}", userId, boutiqueId, magasinId, from, to);

        jakarta.persistence.Query q = em.createNativeQuery(sql.toString());
        if (userId != null) q.setParameter("userId", userId);
        if (boutiqueId != null) q.setParameter("boutiqueId", boutiqueId);
        if (magasinId != null) q.setParameter("magasinId", magasinId);
        if (from != null) q.setParameter("from", from);
        if (to != null) q.setParameter("to", to);

        @SuppressWarnings("unchecked")
        java.util.List<Object[]> rows = q.getResultList();

        java.util.List<com.smboutique.api.service.dto.CaisseSummaryItem> items = new java.util.ArrayList<>();
        long totalEnt = 0, totalSort = 0;
        for (Object[] row : rows) {
            String per = row[0] == null ? "" : String.valueOf(row[0]);
            Number ent = row[1] == null ? 0 : (Number) row[1];
            Number sort = row[2] == null ? 0 : (Number) row[2];
            long lent = ent.longValue();
            long lsort = sort.longValue();
            items.add(new com.smboutique.api.service.dto.CaisseSummaryItem(per, lent, lsort));
            totalEnt += lent;
            totalSort += lsort;
        }
        return new com.smboutique.api.service.dto.CaisseSummaryResult(items, totalEnt, totalSort, deviseSymbole);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public com.smboutique.api.model.Mouvement createUtilisation(com.smboutique.api.dto.UtilisationRequest req, com.smboutique.api.model.Utilisateur currentUser) {
        if (req == null) throw new IllegalArgumentException("Request required");
        if (req.quantite == null || req.quantite <= 0) throw new IllegalArgumentException("Quantité doit être > 0");
        String sous = req.sousType == null ? "UTILISATION" : req.sousType.toUpperCase();
        if (!"UTILISATION".equals(sous) && !"PERTE".equals(sous)) throw new IllegalArgumentException("sousType invalide");

        Produit produit = produitService.findById(req.produitId).orElseThrow(() -> new IllegalArgumentException("Produit introuvable"));
        Stock stock = null;
        if (req.magasinId != null) {
            stock = stockService.getStockByProduitAndMagasin(req.produitId, req.magasinId).orElse(null);
            if (stock == null) {
                throw new IllegalArgumentException("Stock introuvable pour ce produit et magasin");
            }
        } else {
            // pick boutique-level stock for current user's boutique
            if (currentUser.getBoutique() == null) throw new IllegalArgumentException("Utilisateur sans boutique");
            java.util.List<Stock> stocks = stockService.getStocksByProduitAndBoutique(req.produitId, currentUser.getBoutique().getId());
            if (stocks == null || stocks.isEmpty()) throw new IllegalArgumentException("Stock introuvable pour ce produit et boutique");
            stock = stocks.get(0);
        }

        if (stock.getQuantiteDisponible() == null || stock.getQuantiteDisponible() < req.quantite) {
            throw new IllegalArgumentException("Quantité insuffisante en stock");
        }

        // Lock stock before decrement to avoid lost updates
        if (stock.getId() != null) {
            stock = stockRepository.findByIdForUpdate(stock.getId()).orElse(stock);
        }

        if (stock.getQuantiteDisponible() == null || stock.getQuantiteDisponible() < req.quantite) {
            throw new IllegalArgumentException("Quantité insuffisante en stock");
        }

        // decrement stock
        stock.setQuantiteDisponible(stock.getQuantiteDisponible() - req.quantite);
        stockService.saveStock(stock);

        // create mouvement
        Mouvement mv = new Mouvement();
        mv.setProduit(produit);
        mv.setStock(stock);
        mv.setBoutique(currentUser.getBoutique());
        if (req.magasinId != null) {
            Magasin m = magasinService.findById(req.magasinId).orElse(null);
            mv.setMagasin(m);
        }
        mv.setQuantite(req.quantite);
        mv.setTypeMouvement("UTILISATION");
        mv.setSousType(sous);
        mv.setDescription(req.description);
        mv.setUtilisateur(currentUser);
        mv.setDateMouvement(java.time.LocalDateTime.now());

        // persist mouvement first so we have an id
        Mouvement saved = mouvementRepository.save(mv);

        // Also create a record in utilisation_pertes for audit/history and link to mouvement
        try {
            com.smboutique.api.model.UtilisationPertes up = new com.smboutique.api.model.UtilisationPertes();
            up.setMotif(req.description != null ? req.description : null);
            up.setQuantite(req.quantite);
            up.setDate(java.time.LocalDate.now());
            up.setType(sous);
            up.setProduit(produit);
            up.setMouvementId(saved.getId());
            utilisationPertesService.save(up);
        } catch (Exception ex) {
            // Log but do not fail the main operation — mouvement has been applied
            log.warn("Failed to create UtilisationPertes record: {}", ex.getMessage());
        }

        return saved;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public com.smboutique.api.model.Mouvement updateUtilisation(Long id, com.smboutique.api.model.Mouvement mouvementDetails, com.smboutique.api.model.Utilisateur currentUser) {
        java.util.Optional<Mouvement> existingOpt = mouvementRepository.findById(id);
        if (existingOpt.isEmpty()) throw new IllegalArgumentException("Mouvement introuvable");
        Mouvement existing = existingOpt.get();
        if (!"UTILISATION".equalsIgnoreCase(existing.getTypeMouvement())) {
            throw new IllegalArgumentException("Mouvement n'est pas une UTILISATION");
        }

        Integer oldQty = existing.getQuantite() == null ? 0 : existing.getQuantite();
        Stock oldStock = existing.getStock();

        // determine target stock based on mouvementDetails (prefer explicit stock id, then magasin + produit, then boutique-level)
        Stock targetStock = null;
        if (mouvementDetails.getStock() != null && mouvementDetails.getStock().getId() != null) {
            targetStock = stockService.getStockById(mouvementDetails.getStock().getId()).orElse(null);
        }
        if (targetStock == null) {
            if (mouvementDetails.getMagasin() != null && mouvementDetails.getMagasin().getId() != null && mouvementDetails.getProduit() != null && mouvementDetails.getProduit().getId() != null) {
                targetStock = stockService.getStockByProduitAndMagasin(mouvementDetails.getProduit().getId(), mouvementDetails.getMagasin().getId()).orElse(null);
            }
        }
        if (targetStock == null) {
            if (currentUser.getBoutique() != null && mouvementDetails.getProduit() != null && mouvementDetails.getProduit().getId() != null) {
                java.util.List<Stock> stocks = stockService.getStocksByProduitAndBoutique(mouvementDetails.getProduit().getId(), currentUser.getBoutique().getId());
                if (stocks != null && !stocks.isEmpty()) targetStock = stocks.get(0);
            }
        }
        if (targetStock == null) throw new IllegalArgumentException("Stock cible introuvable pour la mise à jour");

        // Lock involved stocks in deterministic order to reduce deadlocks
        if (oldStock != null && oldStock.getId() != null && targetStock.getId() != null && !oldStock.getId().equals(targetStock.getId())) {
            Long oldId = oldStock.getId();
            Long newId = targetStock.getId();
            if (oldId < newId) {
                oldStock = stockRepository.findByIdForUpdate(oldId).orElse(oldStock);
                targetStock = stockRepository.findByIdForUpdate(newId).orElse(targetStock);
            } else {
                targetStock = stockRepository.findByIdForUpdate(newId).orElse(targetStock);
                oldStock = stockRepository.findByIdForUpdate(oldId).orElse(oldStock);
            }
        } else {
            if (oldStock != null && oldStock.getId() != null) {
                oldStock = stockRepository.findByIdForUpdate(oldStock.getId()).orElse(oldStock);
            }
            if (targetStock.getId() != null) {
                targetStock = stockRepository.findByIdForUpdate(targetStock.getId()).orElse(targetStock);
            }
        }

        Integer newQty = mouvementDetails.getQuantite() == null ? 0 : mouvementDetails.getQuantite();
        if (newQty <= 0) throw new IllegalArgumentException("Quantité doit être > 0");

        // handle same stock case
        if (oldStock != null && targetStock.getId().equals(oldStock.getId())) {
            int delta = newQty - oldQty;
            if (delta > 0) {
                Integer avail = targetStock.getQuantiteDisponible() == null ? 0 : targetStock.getQuantiteDisponible();
                if (avail < delta) throw new IllegalArgumentException("Quantité insuffisante en stock pour l'augmentation");
                targetStock.setQuantiteDisponible(avail - delta);
                stockService.saveStock(targetStock);
            } else if (delta < 0) {
                int restore = -delta;
                Integer avail = targetStock.getQuantiteDisponible() == null ? 0 : targetStock.getQuantiteDisponible();
                targetStock.setQuantiteDisponible(avail + restore);
                stockService.saveStock(targetStock);
            }
        } else {
            // stock changed: restore oldStock by oldQty, then deduct newQty from targetStock
            if (oldStock != null) {
                Integer availOld = oldStock.getQuantiteDisponible() == null ? 0 : oldStock.getQuantiteDisponible();
                oldStock.setQuantiteDisponible(availOld + oldQty);
                stockService.saveStock(oldStock);
            }
            Integer availNew = targetStock.getQuantiteDisponible() == null ? 0 : targetStock.getQuantiteDisponible();
            if (availNew < newQty) throw new IllegalArgumentException("Quantité insuffisante en stock cible pour la mise à jour");
            targetStock.setQuantiteDisponible(availNew - newQty);
            stockService.saveStock(targetStock);
        }

        // apply fields and save mouvement
        existing.setProduit(mouvementDetails.getProduit());
        existing.setStock(targetStock);
        existing.setMagasin(mouvementDetails.getMagasin());
        existing.setQuantite(newQty);
        existing.setSousType(mouvementDetails.getSousType());
        existing.setDescription(mouvementDetails.getDescription());
        existing.setDateMouvement(mouvementDetails.getDateMouvement() != null ? mouvementDetails.getDateMouvement() : java.time.LocalDateTime.now());

        Mouvement saved = mouvementRepository.save(existing);

        // sync utilisation_pertes
        try {
            java.util.Optional<com.smboutique.api.model.UtilisationPertes> upOpt = utilisationPertesService.findByMouvementId(saved.getId());
            if (upOpt.isPresent()) {
                com.smboutique.api.model.UtilisationPertes up = upOpt.get();
                up.setQuantite(saved.getQuantite());
                up.setMotif(saved.getDescription());
                up.setDate(saved.getDateMouvement() != null ? saved.getDateMouvement().toLocalDate() : java.time.LocalDate.now());
                up.setType(saved.getSousType());
                up.setProduit(saved.getProduit());
                utilisationPertesService.save(up);
            }
        } catch (Exception ex) {
            log.warn("Failed to synchronize utilisation_pertes on update: {}", ex.getMessage());
        }

        return saved;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public com.smboutique.api.model.Mouvement createUtilisationFromUtilisationPertes(com.smboutique.api.model.UtilisationPertes up, com.smboutique.api.model.Utilisateur currentUser) {
        if (up == null) throw new IllegalArgumentException("UtilisationPertes required");
        if (up.getQuantite() == null || up.getQuantite() <= 0) throw new IllegalArgumentException("Quantité doit être > 0");
        if (up.getProduit() == null || up.getProduit().getId() == null) throw new IllegalArgumentException("Produit requis");

        Long boutiqueId = null;
        if (up.getBoutique() != null && up.getBoutique().getId() != null) {
            boutiqueId = up.getBoutique().getId();
        } else if (currentUser != null && currentUser.getBoutique() != null) {
            boutiqueId = currentUser.getBoutique().getId();
        } else {
            throw new IllegalArgumentException("Boutique requise pour l'opération");
        }

        // determine stock: prefer magasin-level if provided
        Stock stock = null;
        if (up.getMagasin() != null && up.getMagasin().getId() != null) {
            stock = stockService.getStockByProduitAndMagasin(up.getProduit().getId(), up.getMagasin().getId()).orElse(null);
            if (stock == null) throw new IllegalArgumentException("Stock introuvable pour ce produit et magasin");
        } else {
            java.util.List<Stock> stocks = stockService.getStocksByProduitAndBoutique(up.getProduit().getId(), boutiqueId);
            if (stocks == null || stocks.isEmpty()) throw new IllegalArgumentException("Stock introuvable pour ce produit et boutique");
            stock = stocks.get(0);
        }

        if (stock.getQuantiteDisponible() == null || stock.getQuantiteDisponible() < up.getQuantite()) {
            throw new IllegalArgumentException("Quantité insuffisante en stock");
        }

        // Lock stock before decrement to avoid lost updates
        if (stock.getId() != null) {
            stock = stockRepository.findByIdForUpdate(stock.getId()).orElse(stock);
        }

        if (stock.getQuantiteDisponible() == null || stock.getQuantiteDisponible() < up.getQuantite()) {
            throw new IllegalArgumentException("Quantité insuffisante en stock");
        }

        // decrement stock
        stock.setQuantiteDisponible(stock.getQuantiteDisponible() - up.getQuantite());
        stockService.saveStock(stock);

        // create mouvement
        Mouvement mv = new Mouvement();
        mv.setProduit(up.getProduit());
        mv.setStock(stock);
        mv.setBoutique(up.getBoutique() != null ? up.getBoutique() : (currentUser != null ? currentUser.getBoutique() : null));
        mv.setQuantite(up.getQuantite());
        mv.setTypeMouvement("UTILISATION");
        mv.setSousType(up.getType());
        mv.setDescription(up.getMotif());
        mv.setUtilisateur(currentUser);
        mv.setDateMouvement(java.time.LocalDateTime.now());

        Mouvement saved = mouvementRepository.save(mv);

        // persist or update utilisation_pertes linking to mouvement
        try {
            up.setMouvementId(saved.getId());
            up.setDate(saved.getDateMouvement() != null ? saved.getDateMouvement().toLocalDate() : java.time.LocalDate.now());
            utilisationPertesService.save(up);
        } catch (Exception ex) {
            log.warn("Failed to create UtilisationPertes record while creating from UtilisationPertes: {}", ex.getMessage());
        }

        return saved;
    }
}

