package com.smboutique.api.repository;

import com.smboutique.api.model.CaisseTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CaisseTransactionRepository extends JpaRepository<CaisseTransaction, Long> {
    List<CaisseTransaction> findByReferenceCaisse(String referenceCaisse);
    List<CaisseTransaction> findByBoutiqueId(Long boutiqueId);
}