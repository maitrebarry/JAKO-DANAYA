package com.smboutique.api.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ReceptionListDTO {
    private Long idReception;
    private LocalDateTime dateReception;
    private String receptRef;
    private String referenceCommande;
    private String nomFournisseur;
    private String prenomFournisseur;
}