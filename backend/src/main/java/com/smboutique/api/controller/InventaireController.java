package com.smboutique.api.controller;

import com.smboutique.api.model.Inventaire;
import com.smboutique.api.service.InventaireService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/inventaires")
@CrossOrigin(origins = "*")
public class InventaireController {

    @Autowired
    private InventaireService inventaireService;

    @GetMapping
    public List<Inventaire> getAllInventaires() {
        return inventaireService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Inventaire> getInventaireById(@PathVariable Long id) {
        return inventaireService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Inventaire createInventaire(@RequestBody Inventaire inventaire) {
        return inventaireService.save(inventaire);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Inventaire> updateInventaire(@PathVariable Long id, @RequestBody Inventaire inventaireDetails) {
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaire.setReference(inventaireDetails.getReference());
                    inventaire.setDateInventaire(inventaireDetails.getDateInventaire());
                    return ResponseEntity.ok(inventaireService.save(inventaire));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInventaire(@PathVariable Long id) {
        return inventaireService.findById(id)
                .map(inventaire -> {
                    inventaireService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
