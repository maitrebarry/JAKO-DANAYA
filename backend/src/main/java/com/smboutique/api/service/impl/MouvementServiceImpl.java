package com.smboutique.api.service.impl;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.repository.MouvementRepository;
import com.smboutique.api.service.MouvementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.smboutique.api.service.MouvementSearchResult;

@Service
public class MouvementServiceImpl implements MouvementService {

    @Autowired
    private MouvementRepository mouvementRepository;

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
    public void deleteById(Long id) {
        mouvementRepository.deleteById(id);
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
}
