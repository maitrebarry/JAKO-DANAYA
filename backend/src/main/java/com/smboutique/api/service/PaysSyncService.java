package com.smboutique.api.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smboutique.api.model.Pays;
import com.smboutique.api.repository.PaysRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.context.event.EventListener;

import java.time.Duration;
import java.util.Iterator;

@Service
public class PaysSyncService {

    private final PaysRepository paysRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper mapper = new ObjectMapper();

    @Autowired
    public PaysSyncService(PaysRepository paysRepository, RestTemplateBuilder restTemplateBuilder) {
        this.paysRepository = paysRepository;
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }

    /**
     * Ensure a Pays entity exists for the given ISO code (2 letters) by fetching details
     * from restcountries.com if not present in DB.
     */
    public Pays ensurePays(String codeIso) {
        if (codeIso == null || codeIso.isBlank()) return null;
        String code = codeIso.toUpperCase();
        return paysRepository.findByCodeIso(code).orElseGet(() -> fetchAndSave(code));
    }

    /**
     * Force re-fetch of a single country from restcountries and replace the DB entry if present.
     */
    public Pays refreshPays(String codeIso) {
        if (codeIso == null || codeIso.isBlank()) return null;
        String code = codeIso.toUpperCase();
        try {
            // Do not delete existing DB row (FK constraints). fetchAndSave now upserts the existing Pays entry.
            return fetchAndSave(code);
        } catch (Exception e) {
            System.err.println("Erreur refreshPays " + code + ": " + e.getMessage());
            return null;
        }
    }

    @EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void runInitialSyncIfNeeded() {
        try {
            long c = paysRepository.count();
            if (c < 10) {
                System.out.println("Pays count < 10, performing initial sync from restcountries");
                int synced = syncAll();
                System.out.println("Initial pays sync completed: " + synced);
            }
        } catch (Exception e) {
            System.err.println("Error during initial pays sync: " + e.getMessage());
        }
    }

    public int syncAll() {
        try {
            // Request only necessary fields to avoid API rejection and reduce payload
            String url = "https://restcountries.com/v3.1/all?fields=cca2,cca3,name,idd,currencies,flags";
            ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return 0;

            JsonNode root = mapper.readTree(resp.getBody());
            if (!root.isArray()) return 0;

            int count = 0;
            for (JsonNode node : root) {
                try {
                    String code = node.path("cca2").asText();
                    if (code == null || code.isBlank()) continue;
                    code = code.toUpperCase();
                    String nom = node.path("name").path("common").asText(code);

                    // Construct phone indicatif from idd
                    String indicatif = null;
                    JsonNode idd = node.path("idd");
                    if (!idd.isMissingNode()) {
                        String rootStr = idd.path("root").asText("");
                        JsonNode suffixes = idd.path("suffixes");
                        if (!rootStr.isBlank() && suffixes.isArray() && suffixes.size() > 0) {
                            String suffix = suffixes.get(0).asText("");
                            indicatif = rootStr + suffix;
                        } else if (!rootStr.isBlank()) {
                            indicatif = rootStr;
                        }
                    }

                    // currencies
                    String deviseCode = null;
                    String deviseSymbole = null;
                    JsonNode currencies = node.path("currencies");
                    if (currencies != null && currencies.fieldNames().hasNext()) {
                        Iterator<String> it = currencies.fieldNames();
                        if (it.hasNext()) {
                            String curCode = it.next();
                            deviseCode = curCode;
                            JsonNode curNode = currencies.path(curCode);
                            String rawSymbol = curNode.path("symbol").asText("");
                            deviseSymbole = computeDisplaySymbol(curCode, rawSymbol);
                        }
                    }

                    String drapeau = node.path("flags").path("png").asText("");

                    Pays p = paysRepository.findByCodeIso(code).orElse(new Pays());
                    p.setCodeIso(code);
                    p.setNom(nom);
                    p.setIndicatif(indicatif != null ? indicatif : "");
                    p.setDeviseCode(deviseCode);
                    p.setDeviseSymbole(deviseSymbole);
                    p.setDrapeau(drapeau);
                    paysRepository.save(p);
                    count++;
                } catch (Exception e) {
                    // ignore single errors
                }
            }
            return count;
        } catch (Exception ex) {
            System.err.println("Erreur syncAll pays: " + ex.getMessage());
            return 0;
        }
    }

    private Pays fetchAndSave(String codeIso) {
        try {
            String url = "https://restcountries.com/v3.1/alpha/" + codeIso + "?fields=cca2,cca3,name,idd,currencies,flags";
            ResponseEntity<String> resp = restTemplate.getForEntity(url, String.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) return null;

            JsonNode root = mapper.readTree(resp.getBody());
            // API can return array or object; handle array case
            JsonNode node = root.isArray() && root.size() > 0 ? root.get(0) : root;
            if (node == null) return null;

            String nom = node.path("name").path("common").asText(codeIso);

            // Construct phone indicatif from idd
            String indicatif = null;
            JsonNode idd = node.path("idd");
            if (!idd.isMissingNode()) {
                String rootStr = idd.path("root").asText("");
                JsonNode suffixes = idd.path("suffixes");
                if (!rootStr.isBlank() && suffixes.isArray() && suffixes.size() > 0) {
                    String suffix = suffixes.get(0).asText("");
                    indicatif = rootStr + suffix;
                } else if (!rootStr.isBlank()) {
                    indicatif = rootStr;
                }
            }

            // currencies: pick first currency code and symbol
            String deviseCode = null;
            String deviseSymbole = null;
            JsonNode currencies = node.path("currencies");
            if (currencies != null && currencies.fieldNames().hasNext()) {
                Iterator<String> it = currencies.fieldNames();
                if (it.hasNext()) {
                    String curCode = it.next();
                    deviseCode = curCode;
                    JsonNode curNode = currencies.path(curCode);
                    String rawSymbol = curNode.path("symbol").asText("");
                    deviseSymbole = computeDisplaySymbol(curCode, rawSymbol);
                }
            }

            // flag (png)
            String drapeau = node.path("flags").path("png").asText("");

            Pays p = paysRepository.findByCodeIso(codeIso).orElse(new Pays());
            p.setCodeIso(codeIso);
            p.setNom(nom);
            p.setIndicatif(indicatif != null ? indicatif : "");
            p.setDeviseCode(deviseCode);
            p.setDeviseSymbole(deviseSymbole);
            p.setDrapeau(drapeau);

            return paysRepository.save(p);
        } catch (Exception ex) {
            // Don't fail hard if external API fails; log and return null
            System.err.println("Erreur fetch pays " + codeIso + ": " + ex.getMessage());
            return null;
        }
    }

    // Compute a friendly display symbol/name for a currency based on code and raw symbol
    private String computeDisplaySymbol(String curCode, String rawSymbol) {
        if (curCode == null || curCode.isBlank()) return rawSymbol == null ? "" : rawSymbol;
        switch (curCode.toUpperCase()) {
            case "XOF":
            case "XAF":
                return "F CFA"; // West/Central African CFA franc
            case "GNF":
                return "GNF"; // Guinean franc
            case "EUR":
                return (rawSymbol == null || rawSymbol.isBlank()) ? "€" : rawSymbol;
            case "USD":
                return (rawSymbol == null || rawSymbol.isBlank()) ? "$" : rawSymbol;
            case "GBP":
                return (rawSymbol == null || rawSymbol.isBlank()) ? "£" : rawSymbol;
            default:
                return (rawSymbol == null || rawSymbol.isBlank()) ? curCode : rawSymbol;
        }
    }
}
