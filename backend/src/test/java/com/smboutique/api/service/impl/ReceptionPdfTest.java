package com.smboutique.api.service.impl;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.Reception;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import static org.junit.jupiter.api.Assertions.*;

public class ReceptionPdfTest {
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
    public void processReceptionTemplate_withoutBoutique_doesNotThrow() {
        TemplateEngine te = templateEngine();
        Reception r = new Reception();
        r.setReference("R-1");
        Context ctx = new Context();
        ctx.setVariable("reception", r);

        assertDoesNotThrow(() -> {
            String out = te.process("reception_pdf", ctx);
            assertNotNull(out);
        });
    }

    @Test
    public void processReceptionTemplate_withBoutique_rendered() {
        TemplateEngine te = templateEngine();
        Reception r = new Reception();
        r.setReference("R-2");
        CommandeFournisseur c = new CommandeFournisseur();
        c.setReference("CMD-10");
        Boutique b = new Boutique();
        b.setNom("SHOPX");
        b.setTelephoneLocal("7654321");
        b.setAdresse("Rue Test");
        c.setBoutique(b);
        LigneCommande lc = new LigneCommande();
        // do not set designation (derived from stock) to keep test simple
        c.setLignes(java.util.List.of(lc));
        r.setCommandeFournisseur(c);

        Context ctx = new Context();
        ctx.setVariable("reception", r);
        // provide safe variables to mimic what PdfServiceImpl sets
        ctx.setVariable("boutiqueNom", "SHOPX");
        ctx.setVariable("boutiqueTelephone", "7654321");
        ctx.setVariable("boutiqueAdresse", "Rue Test");
        ctx.setVariable("receptionLignes", c.getLignes());

        String out = assertDoesNotThrow(() -> te.process("reception_pdf", ctx));
        assertTrue(out.contains("SHOPX"));
        assertTrue(out.contains("7654321"));
        assertTrue(out.contains("Produit") || out.contains("CMD-10"));
    }
}
