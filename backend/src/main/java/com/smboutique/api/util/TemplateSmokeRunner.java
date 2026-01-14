package com.smboutique.api.util;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

public class TemplateSmokeRunner {
    public static void main(String[] args) {
        TemplateEngine templateEngine = new TemplateEngine();
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        templateEngine.setTemplateResolver(templateResolver);

        try {
            // Case 1: commande without boutique
            CommandeFournisseur c1 = new CommandeFournisseur();
            c1.setReference("SMOKE-1");
            Context ctx1 = new Context();
            ctx1.setVariable("commande", c1);
            String out1 = templateEngine.process("commande_pdf", ctx1);
            System.out.println("SMOKE 1 OK, length=" + (out1 != null ? out1.length() : 0));

            // Case 2: boutique present but no telephone
            CommandeFournisseur c2 = new CommandeFournisseur();
            c2.setReference("SMOKE-2");
            Boutique b2 = new Boutique();
            b2.setNom("SMOKE SHOP");
            c2.setBoutique(b2);
            Context ctx2 = new Context();
            ctx2.setVariable("commande", c2);
            String out2 = templateEngine.process("commande_pdf", ctx2);
            System.out.println("SMOKE 2 OK, length=" + (out2 != null ? out2.length() : 0));

            // Case 3: with safe variables set
            CommandeFournisseur c3 = new CommandeFournisseur();
            c3.setReference("SMOKE-3");
            c3.setTotal(123456);
            Boutique b3 = new Boutique();
            b3.setNom("SMOKE SHOP");
            c3.setBoutique(b3);
            Context ctx3 = new Context();
            ctx3.setVariable("commande", c3);
            ctx3.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx3.setVariable("boutiqueTelephone", "7654321");
            ctx3.setVariable("boutiqueAdresse", "Test City");
            ctx3.setVariable("deviseSymbole", "FCFA");
            ctx3.setVariable("commandeTotalLabel", "123 456 FCFA");
            String out3 = templateEngine.process("commande_pdf", ctx3);
            System.out.println("SMOKE 3 OK, contains phone=" + out3.contains("7654321"));

            // Vente en espèces smoke case: verify currency symbol and boutique data
            java.util.Map<String,Object> vente = new java.util.HashMap<>();
            vente.put("referenceCaisse", "CAISSE-01-2026-N°1");
            vente.put("montantTotal", 880000);
            vente.put("remise", 0);
            vente.put("netAPayer", 880000);
            vente.put("montantRecu", 880000);
            vente.put("monnaieRembourse", 0);
            vente.put("nomClient", "Sali");

            java.util.List<java.util.Map<String,Object>> lignes = new java.util.ArrayList<>();
            java.util.Map<String,Object> lv1 = new java.util.HashMap<>();
            lv1.put("quantite", 1);
            lv1.put("newPrice", 192000);
            lv1.put("prix", 192000);
            lv1.put("designation", "HP EliteBook 850 G8 Notebook");
            java.util.Map<String,Object> prod1 = new java.util.HashMap<>(); prod1.put("nomProduit", "HP EliteBook 850 G8 Notebook"); lv1.put("produit", prod1);
            lignes.add(lv1);
            java.util.Map<String,Object> lv2 = new java.util.HashMap<>(); lv2.put("quantite", 1); lv2.put("newPrice", 160000); lv2.put("prix", 160000); lv2.put("designation", "LENOVO THINKPAD L390 Yoga"); java.util.Map<String,Object> prod2 = new java.util.HashMap<>(); prod2.put("nomProduit", "LENOVO THINKPAD L390 Yoga"); lv2.put("produit", prod2); lignes.add(lv2);
            java.util.Map<String,Object> lv3 = new java.util.HashMap<>(); lv3.put("quantite", 1); lv3.put("newPrice", 288000); lv3.put("prix", 288000); lv3.put("designation", "Fabricant : HP EliteBook 840 G7 (10th Gen )"); java.util.Map<String,Object> prod3 = new java.util.HashMap<>(); prod3.put("nomProduit", "Fabricant : HP EliteBook 840 G7 (10th Gen )"); lv3.put("produit", prod3); lignes.add(lv3);
            java.util.Map<String,Object> lv4 = new java.util.HashMap<>(); lv4.put("quantite", 1); lv4.put("newPrice", 240000); lv4.put("prix", 240000); lv4.put("designation", "LENOVO THINKPAD X1"); java.util.Map<String,Object> prod4 = new java.util.HashMap<>(); prod4.put("nomProduit", "LENOVO THINKPAD X1"); lv4.put("produit", prod4); lignes.add(lv4);

            Context ctx4 = new Context();
            ctx4.setVariable("vente", vente);
            ctx4.setVariable("lignes", lignes);
            ctx4.setVariable("dateVenteFormatted", "14/01/2026 17:50");
            ctx4.setVariable("boutiqueNom", "SMBOUTIQUE");
            ctx4.setVariable("boutiqueTelephone", "98789065");
            ctx4.setVariable("boutiqueAdresse", "Test City");
            ctx4.setVariable("deviseSymbole", "FCFA");
            String out4 = templateEngine.process("vente_espece", ctx4);
            System.out.println("VENTE_ESPECE SMOKE OK len=" + (out4 != null ? out4.length() : 0) + ", has FCFA=" + out4.contains("FCFA") + ", has client=Sali=" + out4.contains("Sali"));

            System.out.println("All smoke cases OK");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(2);
        }
    }
}
