package com.smboutique.api.service;

import com.smboutique.api.service.dto.DashboardOverviewDTO;

public interface DashboardService {
    DashboardOverviewDTO getOverview(Long boutiqueId);
}
