package com.smboutique.api.dto;

import java.time.LocalDateTime;

public class ReceptionStatusDTO {
    private Long idReception;
    private String receptRef;
    private LocalDateTime dateReception;
    private Long idCommandeFournisseur;
    private String commandeStatus; // FINISHED or UNFINISHED

    public Long getIdReception() { return idReception; }
    public void setIdReception(Long idReception) { this.idReception = idReception; }

    public String getReceptRef() { return receptRef; }
    public void setReceptRef(String receptRef) { this.receptRef = receptRef; }

    public LocalDateTime getDateReception() { return dateReception; }
    public void setDateReception(LocalDateTime dateReception) { this.dateReception = dateReception; }

    public Long getIdCommandeFournisseur() { return idCommandeFournisseur; }
    public void setIdCommandeFournisseur(Long idCommandeFournisseur) { this.idCommandeFournisseur = idCommandeFournisseur; }

    public String getCommandeStatus() { return commandeStatus; }
    public void setCommandeStatus(String commandeStatus) { this.commandeStatus = commandeStatus; }
}