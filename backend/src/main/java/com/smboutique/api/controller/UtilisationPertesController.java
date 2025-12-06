package com.smboutique.api.controller;

import com.smboutique.api.model.UtilisationPertes;
import com.smboutique.api.service.UtilisationPertesService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/utilisation-pertes")
@CrossOrigin(origins = "*")
public class UtilisationPertesController {

    @Autowired
    private UtilisationPertesService utilisationPertesService;

    @GetMapping
    public List<UtilisationPertes> getAllUtilisationPertes() {
        return utilisationPertesService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UtilisationPertes> getUtilisationPertesById(@PathVariable Long id) {
        return utilisationPertesService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public UtilisationPertes createUtilisationPertes(@RequestBody UtilisationPertes utilisationPertes) {
        return utilisationPertesService.save(utilisationPertes);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UtilisationPertes> updateUtilisationPertes(@PathVariable Long id, @RequestBody UtilisationPertes utilisationPertesDetails) {
        return utilisationPertesService.findById(id)
                .map(utilisationPertes -> {
                    utilisationPertes.setMotif(utilisationPertesDetails.getMotif());
                    utilisationPertes.setQuantite(utilisationPertesDetails.getQuantite());
                    utilisationPertes.setDate(utilisationPertesDetails.getDate());
                    utilisationPertes.setType(utilisationPertesDetails.getType());
                    utilisationPertes.setProduit(utilisationPertesDetails.getProduit());
                    return ResponseEntity.ok(utilisationPertesService.save(utilisationPertes));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUtilisationPertes(@PathVariable Long id) {
        return utilisationPertesService.findById(id)
                .map(utilisationPertes -> {
                    utilisationPertesService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
