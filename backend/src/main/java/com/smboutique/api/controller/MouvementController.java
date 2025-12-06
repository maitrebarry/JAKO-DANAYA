package com.smboutique.api.controller;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.service.MouvementService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/mouvements")
@CrossOrigin(origins = "*")
public class MouvementController {

    @Autowired
    private MouvementService mouvementService;

    @GetMapping
    public List<Mouvement> getAllMouvements() {
        return mouvementService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Mouvement> getMouvementById(@PathVariable Long id) {
        return mouvementService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Mouvement createMouvement(@RequestBody Mouvement mouvement) {
        return mouvementService.save(mouvement);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Mouvement> updateMouvement(@PathVariable Long id, @RequestBody Mouvement mouvementDetails) {
        return mouvementService.findById(id)
                .map(mouvement -> {
                    mouvement.setLigneReception(mouvementDetails.getLigneReception());
                    mouvement.setLigneLivraison(mouvementDetails.getLigneLivraison());
                    mouvement.setLigneVente(mouvementDetails.getLigneVente());
                    mouvement.setProduit(mouvementDetails.getProduit());
                    mouvement.setQuantite(mouvementDetails.getQuantite());
                    mouvement.setTypeMouvement(mouvementDetails.getTypeMouvement());
                    mouvement.setMontant(mouvementDetails.getMontant());
                    mouvement.setDateMouvement(mouvementDetails.getDateMouvement());
                    return ResponseEntity.ok(mouvementService.save(mouvement));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMouvement(@PathVariable Long id) {
        return mouvementService.findById(id)
                .map(mouvement -> {
                    mouvementService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
