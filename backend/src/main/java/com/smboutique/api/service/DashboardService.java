package com.smboutique.api.service;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.dto.DashboardOverviewDTO;
import com.smboutique.api.service.dto.DashboardPayload;

public interface DashboardService {
    DashboardOverviewDTO getOverview(Long boutiqueId, Long magasinId);

    // Return a role-based dashboard payload filtered for the given user and optional shop
    DashboardPayload getDashboardFor(Utilisateur utilisateur, Long shopId, Long magasinId);
}
