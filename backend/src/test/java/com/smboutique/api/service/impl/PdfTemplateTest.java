package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import static org.junit.jupiter.api.Assertions.*;

public class PdfTemplateTest {

    private TemplateEngine templateEngine() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine te = new TemplateEngine();
        te.setTemplateResolver(templateResolver);
        return te;
    }

    @Test
    public void processTemplate_withNullBoutique_doesNotThrow() {
        TemplateEngine te = templateEngine();
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("TEST-1");
        c.setTotal(12345);

        Context ctx = new Context();
        ctx.setVariable("commande", c);
        // intentionally do NOT set boutiqueNom / boutiqueTelephone / others

        assertDoesNotThrow(() -> {
            String out = te.process("commande_pdf", ctx);
            assertNotNull(out);
        });
    }

    @Test
    public void processTemplate_withBoutiqueNoTelephone_doesNotThrow() {
        TemplateEngine te = templateEngine();
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("TEST-2");
        c.setTotal(0);
        Boutique b = new Boutique();
        b.setNom("MAKAN-SERVICE");
        // no telephone set
        c.setBoutique(b);

        Context ctx = new Context();
        ctx.setVariable("commande", c);
        // ensure template won't fail if phone missing
        assertDoesNotThrow(() -> {
            String out = te.process("commande_pdf", ctx);
            assertNotNull(out);
        });
    }

    @Test
    public void processTemplate_withBoutiqueTelephone_rendered() {
        TemplateEngine te = templateEngine();
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("TEST-3");
        c.setTotal(9999);
        Boutique b = new Boutique();
        b.setNom("MYSHOP");
        c.setBoutique(b);

        Context ctx = new Context();
        ctx.setVariable("commande", c);
        // Set the safe variables that PdfServiceImpl sets
        ctx.setVariable("boutiqueNom", "MYSHOP");
        ctx.setVariable("boutiqueTelephone", "76543218");
        ctx.setVariable("boutiqueAdresse", "Kayes");
        ctx.setVariable("deviseSymbole", "FCFA");
        ctx.setVariable("commandeTotalLabel", "9 999 FCFA");

        String out = assertDoesNotThrow(() -> te.process("commande_pdf", ctx));
        assertTrue(out.contains("76543218"));
        assertTrue(out.contains("MYSHOP"));
        assertTrue(out.contains("9 999"));
    }

    @Test
    public void processTemplate_inventaire_total_label_rendered() {
        TemplateEngine te = templateEngine();
        Context ctx = new Context();
        ctx.setVariable("inventaire", new com.smboutique.api.model.Inventaire());
        ctx.setVariable("lignes", java.util.Collections.emptyList());
        // Set the safe variables that PdfServiceImpl sets
        ctx.setVariable("boutiqueNom", "MYSHOP");
        ctx.setVariable("boutiqueTelephone", "76543218");
        ctx.setVariable("boutiqueAdresse", "Kayes");
        ctx.setVariable("deviseSymbole", "FCFA");
        ctx.setVariable("montantTotalLabel", "71 660 000 FCFA");

        String out = assertDoesNotThrow(() -> te.process("inventaire_pdf", ctx));
        assertTrue(out.contains("71 660 000 FCFA"));
        assertFalse(out.contains("deviseSymbole"));
    }

    @Test
    public void processTemplate_caisse_montant_rendered() {
        TemplateEngine te = templateEngine();
        Context ctx = new Context();
        ctx.setVariable("transaction", new com.smboutique.api.model.CaisseTransaction());
        ctx.setVariable("boutiqueNom", "MYSHOP");
        ctx.setVariable("boutiqueTelephone", "76543218");
        ctx.setVariable("boutiqueAdresse", "Kayes");
        ctx.setVariable("deviseSymbole", "FCFA");
        ctx.setVariable("montantLabel", "71 660 000 FCFA");
        ctx.setVariable("reference", "REF-123");
        ctx.setVariable("utilisateurLabel", "Jean Dupont");

        String out = assertDoesNotThrow(() -> te.process("caisse_pdf", ctx));
        assertTrue(out.contains("71 660 000 FCFA"));
        assertTrue(out.contains("REF-123"));
        assertTrue(out.contains("Jean Dupont"));
        assertFalse(out.contains("deviseSymbole"));
    }
}
