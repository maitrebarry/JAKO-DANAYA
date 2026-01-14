package com.smboutique.api.util;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.LigneCommande;
import com.smboutique.api.model.Reception;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

public class ReceptionSmokeRunner {
    public static void main(String[] args) {
        TemplateEngine templateEngine = new TemplateEngine();
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        templateEngine.setTemplateResolver(templateResolver);

        try {
            Reception r1 = new Reception();
            r1.setReference("R-1");
            Context ctx1 = new Context();
            ctx1.setVariable("reception", r1);
            String out1 = templateEngine.process("reception_pdf", ctx1);
            System.out.println("RECEPTION SMOKE 1 OK, length=" + (out1 != null ? out1.length() : 0));

            Reception r2 = new Reception();
            r2.setReference("R-2");
            CommandeFournisseur c2 = new CommandeFournisseur();
            c2.setReference("CMD-2");
            r2.setCommandeFournisseur(c2);
            Context ctx2 = new Context();
            ctx2.setVariable("reception", r2);
            String out2 = templateEngine.process("reception_pdf", ctx2);
            System.out.println("RECEPTION SMOKE 2 OK, length=" + (out2 != null ? out2.length() : 0));

            Reception r3 = new Reception();
            r3.setReference("R-3");
            CommandeFournisseur c3 = new CommandeFournisseur();
            c3.setReference("CMD-3");
            Boutique b3 = new Boutique();
            b3.setNom("SMOKE SHOP");
            b3.setTelephoneLocal("7654321");
            b3.setAdresse("Test City");
            c3.setBoutique(b3);
            LigneCommande lc = new LigneCommande();
            c3.setLignes(java.util.List.of(lc));
            r3.setCommandeFournisseur(c3);
            Context ctx3 = new Context();
            ctx3.setVariable("reception", r3);
            ctx3.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx3.setVariable("boutiqueTelephone", "7654321");
            ctx3.setVariable("boutiqueAdresse", "Test City");
            ctx3.setVariable("receptionLignes", c3.getLignes());
            String out3 = templateEngine.process("reception_pdf", ctx3);
            System.out.println("RECEPTION SMOKE 3 OK, contains phone=" + out3.contains("7654321"));

            System.out.println("All reception smoke cases OK");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(2);
        }
    }
}
