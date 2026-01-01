package com.smboutique.api.service.impl;

import com.smboutique.api.model.Livraison;
import com.smboutique.api.repository.LivraisonRepository;
import com.smboutique.api.service.LivraisonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class LivraisonServiceImpl implements LivraisonService {

    @Autowired
    private LivraisonRepository livraisonRepository;

    @Override
    public List<Livraison> findAll() {
        return livraisonRepository.findAll();
    }

    @Override
    public Optional<Livraison> findById(Long id) {
        return livraisonRepository.findById(id);
    }

    @Override
    public Livraison save(Livraison livraison) {
        return livraisonRepository.save(livraison);
    }

    @Override
    public void deleteById(Long id) {
        livraisonRepository.deleteById(id);
    }

    @Override
    public List<Livraison> findByBoutiqueId(Long boutiqueId) {
        // Use a fallback query that includes commandes whose utilisateur.boutique matches the given boutique
        List<Livraison> livs = livraisonRepository.findByCommandeClientBoutiqueId(boutiqueId);
        if (livs == null || livs.isEmpty()) {
            livs = livraisonRepository.findByCommandeClientBoutiqueIdOrCommandeClientUtilisateurBoutiqueId(boutiqueId);
        }
        return livs;
    }
}
