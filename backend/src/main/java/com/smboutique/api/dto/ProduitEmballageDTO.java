package com.smboutique.api.dto;

import lombok.Data;

@Data
public class ProduitEmballageDTO {
    private Long id;
    private Long uniteId;
    private String uniteLibelle;
    private Integer nombreUnites;
    private Boolean estParDefaut;
}
