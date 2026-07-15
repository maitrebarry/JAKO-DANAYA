package com.smboutique.api.dto;

import lombok.Data;

@Data
public class ProduitEmballageRequest {
    private Long uniteId;
    private Integer nombreUnites;
    private Boolean estParDefaut;
}
