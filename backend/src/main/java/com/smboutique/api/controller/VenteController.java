package com.smboutique.api.controller;

import com.smboutique.api.model.Vente;
import com.smboutique.api.service.VenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/ventes")
@CrossOrigin(origins = "*")
public class VenteController {

    @Autowired
    private VenteService venteService;

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
    public Vente createVente(@RequestBody Vente vente) {
        return venteService.save(vente);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Vente> updateVente(@PathVariable Long id, @RequestBody Vente venteDetails) {
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
        return venteService.findById(id)
                .map(vente -> {
                    venteService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
