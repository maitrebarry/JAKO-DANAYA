package com.smboutique.api.util;

import com.smboutique.api.model.Boutique;
import com.smboutique.api.model.CommandeFournisseur;
import com.smboutique.api.model.Paiement;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

public class PaiementSmokeRunner {
    public static void main(String[] args) {
        TemplateEngine templateEngine = new TemplateEngine();
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("/templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode("HTML");
        templateResolver.setCharacterEncoding("UTF-8");
        templateEngine.setTemplateResolver(templateResolver);

        try {
            // Case 1: paiement without commande
            Paiement p1 = new Paiement();
            p1.setReference("P-1");
            Context ctx1 = new Context();
            ctx1.setVariable("paiement", p1);
            String out1 = templateEngine.process("paiement_pdf", ctx1);
            System.out.println("PAIEMENT SMOKE 1 OK, length=" + (out1 != null ? out1.length() : 0));

            // Case 2: paiement with commande but no boutique
            Paiement p2 = new Paiement();
            p2.setReference("P-2");
            CommandeFournisseur c2 = new CommandeFournisseur();
            c2.setReference("CMD-1");
            p2.setCommandeFournisseur(c2);
            Context ctx2 = new Context();
            ctx2.setVariable("paiement", p2);
            String out2 = templateEngine.process("paiement_pdf", ctx2);
            System.out.println("PAIEMENT SMOKE 2 OK, length=" + (out2 != null ? out2.length() : 0));

            // Case 3: paiement with boutique and safe variables
            Paiement p3 = new Paiement();
            p3.setReference("P-3");
            CommandeFournisseur c3 = new CommandeFournisseur();
            c3.setReference("CMD-2");
            c3.setTotal(13400000);
            Boutique b3 = new Boutique();
            b3.setNom("SMOKE SHOP");
            b3.setTelephoneLocal("7654321");
            c3.setBoutique(b3);
            p3.setCommandeFournisseur(c3);
            Context ctx3 = new Context();
            ctx3.setVariable("paiement", p3);
            ctx3.setVariable("boutiqueNom", "SMOKE SHOP");
            ctx3.setVariable("boutiqueTelephone", "7654321");
            ctx3.setVariable("boutiqueAdresse", "Test City");
            ctx3.setVariable("deviseSymbole", "FCFA");
            ctx3.setVariable("montantTotalLabel", "13 400 000 FCFA");
            ctx3.setVariable("montantPayeCommandeLabel", "0 FCFA");
            ctx3.setVariable("montantRestantLabel", "13 400 000 FCFA");
            ctx3.setVariable("montantPayeThisLabel", "0 FCFA");
            ctx3.setVariable("paiementPar", "Admin");
            String out3 = templateEngine.process("paiement_pdf", ctx3);
            System.out.println("PAIEMENT SMOKE 3 OK, contains phone=" + out3.contains("7654321"));

            System.out.println("All paiement smoke cases OK");
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(2);
        }
    }
}
