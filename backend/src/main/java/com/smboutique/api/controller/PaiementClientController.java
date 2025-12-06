package com.smboutique.api.controller;

import com.smboutique.api.model.PaiementClient;
import com.smboutique.api.service.PaiementClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/paiements-clients")
@CrossOrigin(origins = "*")
public class PaiementClientController {

    @Autowired
    private PaiementClientService paiementClientService;

    @GetMapping
    public List<PaiementClient> getAllPaiementClients() {
        return paiementClientService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaiementClient> getPaiementClientById(@PathVariable Long id) {
        return paiementClientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public PaiementClient createPaiementClient(@RequestBody PaiementClient paiementClient) {
        return paiementClientService.save(paiementClient);
    }

    @PutMapping("/{id}")
    public ResponseEntity<PaiementClient> updatePaiementClient(@PathVariable Long id, @RequestBody PaiementClient paiementClientDetails) {
        return paiementClientService.findById(id)
                .map(paiementClient -> {
                    paiementClient.setMontantPaye(paiementClientDetails.getMontantPaye());
                    paiementClient.setDatePaie(paiementClientDetails.getDatePaie());
                    paiementClient.setReference(paiementClientDetails.getReference());
                    paiementClient.setCommandeClient(paiementClientDetails.getCommandeClient());
                    paiementClient.setReferenceCaisse(paiementClientDetails.getReferenceCaisse());
                    return ResponseEntity.ok(paiementClientService.save(paiementClient));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePaiementClient(@PathVariable Long id) {
        return paiementClientService.findById(id)
                .map(paiementClient -> {
                    paiementClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
