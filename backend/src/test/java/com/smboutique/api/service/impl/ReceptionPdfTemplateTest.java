package com.smboutique.api.service.impl;

import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

public class ReceptionPdfTemplateTest {

    @Test
    public void template_should_render_designation_from_lignesView() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        TemplateEngine templateEngine = new TemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);

        Context ctx = new Context();
        Map<String,Object> ligne = new HashMap<>();
        ligne.put("designation", "Produit Test 123");
        ligne.put("qteCommande", 10);
        ligne.put("qteRecueThis", 5);
        ligne.put("qteRecueThisLabel", "5 Pieces");
        ligne.put("qteRestante", 5);
        ligne.put("qteRestanteLabel", "5 Pieces");
        ligne.put("qteCommandeLabel", "10 Pieces");
        ligne.put("nombreUnitesParConditionnement", 1);
        ligne.put("uniteConditionnementLibelle", "Pieces");
        List<Map<String,Object>> lignesView = new ArrayList<>();
        lignesView.add(ligne);
        ctx.setVariable("lignesView", lignesView);

        // Provide a minimal 'reception' object expected by the template to avoid OGNL null access
        Map<String,Object> reception = new HashMap<>();
        reception.put("reference", "REC-TEST-1");
        Map<String,Object> cmd = new HashMap<>();
        Map<String,Object> fournisseur = new HashMap<>();
        fournisseur.put("nom", "FournisseurTest");
        fournisseur.put("prenom", "PrenomTest");
        cmd.put("fournisseur", fournisseur);
        cmd.put("reference", "CMF-TEST-1");
        reception.put("commandeFournisseur", cmd);
        ctx.setVariable("reception", reception);
        ctx.setVariable("dateReceptionFormatted", "01/02/2026 12:00:00");

        String html = templateEngine.process("reception_pdf", ctx);
        assertNotNull(html);
        // write debug copy
        try {
            java.nio.file.Files.write(java.nio.file.Paths.get("/tmp/reception_test_debug.html"), html.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception ignore) {}
        assertTrue(html.contains("Produit Test 123"), "Rendered HTML should contain the designation from lignesView");
        assertTrue(html.contains("Qté Reçue") || html.contains("Qté Reçue"), "Header should be present");
    }
}
