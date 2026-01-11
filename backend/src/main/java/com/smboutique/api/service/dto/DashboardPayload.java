package com.smboutique.api.service.dto;

import java.util.List;
import java.util.Map;

public class DashboardPayload {
    public String role;
    public Map<String, Object> widgets;
    public List<Section> sections;
    public Shop currentBoutique;

    public static class Section {
        public String role;
        public List<Widget> widgets;
        public List<Shop> shops;
    }

    public static class Widget {
        public String key;
        public String permission;
        public Map<String, Object> data;
    }

    public static class Shop {
        public Long id;
        public String nom;
        public Shop() {}
        public Shop(Long id, String nom) { this.id = id; this.nom = nom; }
    }
}
