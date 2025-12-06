package com.smboutique.api.controller;

import com.smboutique.api.model.CommandeClient;
import com.smboutique.api.service.CommandeClientService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/commandes-clients")
@CrossOrigin(origins = "*")
public class CommandeClientController {

    @Autowired
    private CommandeClientService commandeClientService;

    @GetMapping
    public List<CommandeClient> getAllCommandeClients() {
        return commandeClientService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<CommandeClient> getCommandeClientById(@PathVariable Long id) {
        return commandeClientService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public CommandeClient createCommandeClient(@RequestBody CommandeClient commandeClient) {
        return commandeClientService.save(commandeClient);
    }

    @PutMapping("/{id}")
    public ResponseEntity<CommandeClient> updateCommandeClient(@PathVariable Long id, @RequestBody CommandeClient commandeClientDetails) {
        return commandeClientService.findById(id)
                .map(commandeClient -> {
                    commandeClient.setReference(commandeClientDetails.getReference());
                    commandeClient.setDateCommande(commandeClientDetails.getDateCommande());
                    commandeClient.setTotal(commandeClientDetails.getTotal());
                    commandeClient.setPaie(commandeClientDetails.getPaie());
                    commandeClient.setClient(commandeClientDetails.getClient());
                    return ResponseEntity.ok(commandeClientService.save(commandeClient));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCommandeClient(@PathVariable Long id) {
        return commandeClientService.findById(id)
                .map(commandeClient -> {
                    commandeClientService.deleteById(id);
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}
