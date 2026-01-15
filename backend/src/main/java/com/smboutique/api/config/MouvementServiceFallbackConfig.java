package com.smboutique.api.config;

import com.smboutique.api.model.Mouvement;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.service.MouvementSearchResult;
import com.smboutique.api.service.MouvementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Configuration
public class MouvementServiceFallbackConfig {

    private static final Logger log = LoggerFactory.getLogger(MouvementServiceFallbackConfig.class);

    @Bean
    @ConditionalOnMissingBean(MouvementService.class)
    public MouvementService fallbackMouvementService() {
        log.warn("No MouvementService bean found — registering fallback no-op MouvementService. Please investigate real implementation.");
        return new MouvementService() {
            @Override
            public List<Mouvement> findAll() {
                return Collections.emptyList();
            }

            @Override
            public Optional<Mouvement> findById(Long id) {
                return Optional.empty();
            }

            @Override
            public Mouvement save(Mouvement mouvement) {
                log.warn("FallbackMouvementService.save called — operation ignored");
                return mouvement;
            }

            @Override
            public void deleteById(Long id) {
                log.warn("FallbackMouvementService.deleteById called for id={}", id);
            }

            @Override
            public List<Mouvement> search(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, LocalDateTime from, LocalDateTime to) {
                return Collections.emptyList();
            }

            @Override
            public MouvementSearchResult searchPage(Long userId, String type, String sousType, Long boutiqueId, Long magasinId, Long referenceId, LocalDateTime from, LocalDateTime to, int page, int size) {
                return new MouvementSearchResult(Collections.emptyList(), 0L);
            }

            @Override
            public void log(String type, String sousType, String description, Long referenceId, Long boutiqueId, Long magasinId, Long utilisateurId, Double montant) {
                log.info("Fallback log: type={} sousType={} desc={} userId={}", type, sousType, description, utilisateurId);
            }

            @Override
            public com.smboutique.api.service.dto.CaisseSummaryResult summarizeCaisse(String period, Long userId, Long boutiqueId, Long magasinId, LocalDateTime from, LocalDateTime to) {
                return new com.smboutique.api.service.dto.CaisseSummaryResult(Collections.emptyList(), 0L, 0L, null);
            }

            @Override
            public com.smboutique.api.model.Mouvement createUtilisation(com.smboutique.api.dto.UtilisationRequest req, Utilisateur currentUser) {
                throw new UnsupportedOperationException("createUtilisation not supported by fallback") ;
            }

            @Override
            public com.smboutique.api.model.Mouvement createUtilisationFromUtilisationPertes(com.smboutique.api.model.UtilisationPertes up, Utilisateur currentUser) {
                throw new UnsupportedOperationException("createUtilisationFromUtilisationPertes not supported by fallback") ;
            }

            @Override
            public com.smboutique.api.model.Mouvement updateUtilisation(Long id, com.smboutique.api.model.Mouvement mouvementDetails, Utilisateur currentUser) {
                throw new UnsupportedOperationException("updateUtilisation not supported by fallback") ;
            }
        };
    }
}
