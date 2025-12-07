package com.smboutique.api.repository;

import com.smboutique.api.model.Reception;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ReceptionRepository extends JpaRepository<Reception, Long> {
    List<Reception> findByBoutiqueId(Long boutiqueId);
}
