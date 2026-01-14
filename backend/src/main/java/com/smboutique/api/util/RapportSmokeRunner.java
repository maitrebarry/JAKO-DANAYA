package com.smboutique.api.util;

import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.util.*;

public class RapportSmokeRunner {
    public static void main(String[] args) {
        TemplateEngine templateEngine = new TemplateEngine();
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        templateEngine.setTemplateResolver(templateResolver);

        try {
            // Rapport Ventes
            Context ctx1 = new Context();
            ctx1.setVariable("from", java.time.LocalDate.now().minusDays(7));
            ctx1.setVariable("to", java.time.LocalDate.now());
            List<Map<String,Object>> data = new ArrayList<>();
            Map<String,Object> r = new HashMap<>(); r.put("date", "2026-01-01"); r.put("nombreVentes", 3); r.put("montantTotal", 123456); data.add(r);
            ctx1.setVariable("data", data);
            ctx1.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx1.setVariable("deviseSymbole", "FCFA");
            String out1 = templateEngine.process("rapport_ventes", ctx1);
            System.out.println("RAPPORT_VENTES SMOKE OK len=" + (out1 != null ? out1.length() : 0));

            // Rapport Stock
            Context ctx2 = new Context();
            List<Map<String,Object>> d2 = new ArrayList<>();
            Map<String,Object> r2 = new HashMap<>(); r2.put("produitName", "Produit X"); r2.put("quantiteDisponible", 10); r2.put("costAverage", 500); r2.put("lastPurchasePrice", 400); r2.put("magasinName", "Dépôt"); d2.add(r2);
            ctx2.setVariable("data", d2);
            ctx2.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx2.setVariable("deviseSymbole", "FCFA");
            String out2 = templateEngine.process("rapport_stock", ctx2);
            System.out.println("RAPPORT_STOCK SMOKE OK len=" + (out2 != null ? out2.length() : 0));

            // Rapport Valeur Stock
            Context ctx3 = new Context();
            Map<String,Object> detail = new HashMap<>(); detail.put("produitName", "P1"); detail.put("quantiteDisponible", 5); detail.put("costAverage", 1200); detail.put("lastPurchasePrice", 1100);
            List<Map<String,Object>> details = new ArrayList<>(); details.add(detail);
            Map<String,Object> data3 = new HashMap<>(); data3.put("details", details); data3.put("valeurTotale", 6000);
            ctx3.setVariable("data", data3);
            ctx3.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx3.setVariable("deviseSymbole", "FCFA");
            String out3 = templateEngine.process("rapport_valeur_stock", ctx3);
            System.out.println("RAPPORT_VALEUR_STOCK SMOKE OK len=" + (out3 != null ? out3.length() : 0));

            // Rapport Top Produits
            Context ctx4 = new Context();
            List<Map<String,Object>> top = new ArrayList<>(); Map<String,Object> t1 = new HashMap<>(); t1.put("produitName", "P1"); t1.put("montantTotal", 5000); top.add(t1);
            ctx4.setVariable("data", top);
            ctx4.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx4.setVariable("deviseSymbole", "FCFA");
            String out4 = templateEngine.process("rapport_top_produits", ctx4);
            System.out.println("RAPPORT_TOP_PRODUITS SMOKE OK len=" + (out4 != null ? out4.length() : 0));

            // Inventaire
            Context ctx5 = new Context();
            ctx5.setVariable("reference", "INV-1");
            ctx5.setVariable("par", "User");
            ctx5.setVariable("lignes", new ArrayList<>());
            ctx5.setVariable("montantTotal", 0);
            ctx5.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx5.setVariable("deviseSymbole", "FCFA");
            String out5 = templateEngine.process("inventaire_pdf", ctx5);
            System.out.println("INVENTAIRE SMOKE OK len=" + (out5 != null ? out5.length() : 0));

            // Caisse
            Context ctx6 = new Context();
            ctx6.setVariable("reference", "CAISSE-1");
            ctx6.setVariable("montant", 123);
            ctx6.setVariable("dateTransactionFormatted", "14/01/2026 18:00:00");
            ctx6.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx6.setVariable("deviseSymbole", "FCFA");
            String out6 = templateEngine.process("caisse_pdf", ctx6);
            System.out.println("CAISSE SMOKE OK len=" + (out6 != null ? out6.length() : 0));

            System.out.println("All report smoke cases OK");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(2);
        }
    }
}