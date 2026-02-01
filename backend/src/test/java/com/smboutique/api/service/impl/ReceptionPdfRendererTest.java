package com.smboutique.api.service.impl;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.junit.jupiter.api.Test;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class ReceptionPdfRendererTest {

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
    public void renderReceptionHtmlToPdf_doesNotThrow() throws Exception {
        TemplateEngine te = templateEngine();
        Context ctx = new Context();
        com.smboutique.api.model.Reception r = new com.smboutique.api.model.Reception();
        r.setReference("R-TEST");
        com.smboutique.api.model.CommandeFournisseur c = new com.smboutique.api.model.CommandeFournisseur();
        c.setReference("CMD-TEST");
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique();
        b.setNom("SMOKE SHOP");
        b.setTelephoneLocal("7654321");
        b.setAdresse("Test City");
        c.setBoutique(b);
        r.setCommandeFournisseur(c);
        // provide empty lines list
        r.setCommandeFournisseur(c);

        ctx.setVariable("reception", r);
        ctx.setVariable("boutiqueNom", "SMOKE SHOP");
        ctx.setVariable("boutiqueTelephone", "7654321");
        ctx.setVariable("boutiqueAdresse", "Test City");
        ctx.setVariable("receptionLignes", java.util.List.of());

        String html = te.process("reception_pdf", ctx);
        // sanitize typical named entities
        html = html.replace("&nbsp;", "&#160;");

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(html, null);
            builder.toStream(baos);
            builder.run();
            byte[] pdf = baos.toByteArray();
            assertTrue(pdf.length > 0);
        }
    }
}
