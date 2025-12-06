package com.smboutique.api.controller;

import com.smboutique.api.model.Livraison;
import com.smboutique.api.service.LivraisonService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/livraisons")
@CrossOrigin(origins = "*")
public class LivraisonController {

    @Autowired
    private LivraisonService livraisonService;

    @GetMapping
    public List<Livraison> getAllLivraisons() {
        return livraisonService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Livraison> getLivraisonById(@PathVariable Long id) {
        return livraisonService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Livraison createLivraison(@RequestBody Livraison livraison) {
        return livraisonService.save(livraison);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Livraison> updateLivraison(@PathVariable Long id, @RequestBody Livraison livraisonDetails) {
        return livraisonService.findById(id)
                .map(livraison -> {
                    livraison.setReference(livraisonDetails.getReference());
                    livraison.setDateLivraison(livraisonDetails.getDateLivraison());
                    livraison.setCommandeClient(livraisonDetails.getCommandeClient());
                    return ResponseEntity.ok(livraisonService.save(livraison));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLivraison(@PathVariable Long id) {
        return livraisonService.findById(id)
                .map(livraison -> {
                    livraisonService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
