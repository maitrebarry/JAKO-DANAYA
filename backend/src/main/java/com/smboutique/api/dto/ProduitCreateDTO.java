package com.smboutique.api.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

@Data
public class ProduitCreateDTO {
    @NotBlank
    private String nomProduit;

    private Long uniteConditionnementId; // Optionnel

    @PositiveOrZero
    private Integer nombreUnitesParConditionnement; // Optionnel, requis si uniteConditionnementId est fourni

    @PositiveOrZero
    private Integer quantiteInitiale; // Quantité saisie (en conditionnements)

    private String productImage;

    @NotNull
    @PositiveOrZero
    private Integer prixDetail;

    @PositiveOrZero
    private Integer prixEnGros;

    @PositiveOrZero
    private Integer prixAchat;

    @PositiveOrZero
    private Integer alerteStock;
}