package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Paiement;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import static org.junit.jupiter.api.Assertions.*;

public class PaiementPdfTest {
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
    public void processPaiementTemplate_withNullCommande_doesNotThrow() {
        TemplateEngine te = templateEngine();
        Paiement p = new Paiement();
        p.setReference("PAY-1");
        p.setMontantPaye(1000);

        Context ctx = new Context();
        ctx.setVariable("paiement", p);

        assertDoesNotThrow(() -> {
            String out = te.process("paiement_pdf", ctx);
            assertNotNull(out);
        });
    }

    @Test
    public void processPaiementTemplate_withBoutiqueNoTelephone_doesNotThrow() {
        TemplateEngine te = templateEngine();
        Paiement p = new Paiement();
        p.setReference("PAY-2");
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("CMD-1");
        Boutique b = new Boutique();
        b.setNom("SMOKE-BOUTIQUE");
        // no telephoneLocal set
        c.setBoutique(b);
        p.setCommandeFournisseur(c);

        Context ctx = new Context();
        ctx.setVariable("paiement", p);

        assertDoesNotThrow(() -> {
            String out = te.process("paiement_pdf", ctx);
            assertNotNull(out);
        });
    }

    @Test
    public void processPaiementTemplate_withBoutiqueAndAmounts_rendered() {
        TemplateEngine te = templateEngine();
        Paiement p = new Paiement();
        p.setReference("PAY-3");
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("CMD-2");
        c.setTotal(13400000);
        Boutique b = new Boutique();
        b.setNom("MYSHOP");
        b.setTelephoneLocal("76543218");
        p.setCommandeFournisseur(c);

        Context ctx = new Context();
        ctx.setVariable("paiement", p);
        // Provide the safe variables the service sets
        ctx.setVariable("boutiqueNom", "MYSHOP");
        ctx.setVariable("boutiqueTelephone", "76543218");
        ctx.setVariable("boutiqueAdresse", "Kayes");
        ctx.setVariable("deviseSymbole", "FCFA");
        ctx.setVariable("montantTotalLabel", "13 400 000 FCFA");
        ctx.setVariable("montantPayeCommandeLabel", "0 FCFA");
        ctx.setVariable("montantRestantLabel", "13 400 000 FCFA");
        ctx.setVariable("montantPayeThisLabel", "0 FCFA");
        ctx.setVariable("paiementPar", "Admin User");

        String out = assertDoesNotThrow(() -> te.process("paiement_pdf", ctx));
        assertTrue(out.contains("MYSHOP"));
        assertTrue(out.contains("76543218"));
        assertTrue(out.contains("13 400 000"));
    }
}
