package com.smboutique.api.service;

import com.smboutique.api.dto.ProduitCreateDTO;
import com.smboutique.api.model.Produit;
import com.smboutique.api.model.Stock;
import com.smboutique.api.repository.MagasinRepository;
import com.smboutique.api.repository.ProduitRepository;
import com.smboutique.api.repository.UniteRepository;
import com.smboutique.api.service.impl.ProduitServiceImpl;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@org.mockito.junit.jupiter.MockitoSettings(strictness = org.mockito.quality.Strictness.LENIENT)
public class ProduitServiceImplTest {

    @Mock
    private ProduitRepository produitRepository;

    @Mock
    private UniteRepository uniteRepository;

    @Mock
    private com.smboutique.api.service.UniteService uniteService;

    @Mock
    private MagasinRepository magasinRepository;

    @Mock
    private com.smboutique.api.service.StockService stockService;

    @Mock
    private com.smboutique.api.service.ConfigurationMargeService configurationMargeService;

    @Mock
    private com.smboutique.api.repository.BoutiqueRepository boutiqueRepository;

    @InjectMocks
    private ProduitServiceImpl produitService;

    @Test
    public void create_should_create_boutique_stock_with_quantite_initiale() {
        ProduitCreateDTO dto = new ProduitCreateDTO();
        dto.setNomProduit("TestProd");
        dto.setQuantiteInitiale(2);
        dto.setNombreUnitesParConditionnement(1);

        Long boutiqueId = 10L;

        when(produitRepository.save(any(Produit.class))).thenAnswer(invocation -> {
            Produit p = invocation.getArgument(0);
            p.setId(123L);
            return p;
        });


        // ensure boutiqueRepository returns the boutique so service can set it on the stock
        com.smboutique.api.model.Boutique b = new com.smboutique.api.model.Boutique(); b.setId(boutiqueId);
        when(boutiqueRepository.findById(boutiqueId)).thenReturn(java.util.Optional.of(b));

        dto.setCaracteristique("🔥Processeur : Intel Core i7\n🔥Stockage: 512Go SSD");

        Produit created = produitService.create(dto, boutiqueId);
        assertEquals("🔥Processeur : Intel Core i7\n🔥Stockage: 512Go SSD", created.getCaracteristique());

        ArgumentCaptor<Stock> captor = ArgumentCaptor.forClass(Stock.class);
        verify(stockService, times(1)).saveStock(captor.capture());
        Stock stock = captor.getValue();
        assertNull(stock.getMagasin(), "The created stock should be a boutique-level stock (magasin == null)");
        assertNotNull(stock.getQuantiteDisponible());
        // quantiteInitiale is expressed in conditionnements and should be converted to units (1*2 = 2)
        assertEquals(2, stock.getQuantiteDisponible().intValue());
        assertNotNull(stock.getProduit());
        assertEquals(123L, stock.getProduit().getId().longValue());
        assertNotNull(stock.getBoutique());
        assertEquals(boutiqueId, stock.getBoutique().getId());
    }

    @Test
    public void import_creates_unit_when_user_has_permission() throws Exception {
        // build minimal Excel in-memory with headers: nomProduit, unite_name, nombreUnitesParConditionnement
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.ss.usermodel.Sheet sh = wb.createSheet();
            org.apache.poi.ss.usermodel.Row h = sh.createRow(0);
            h.createCell(0).setCellValue("nomProduit");
            h.createCell(1).setCellValue("unite_name");
            h.createCell(2).setCellValue("nombreUnitesParConditionnement");
            org.apache.poi.ss.usermodel.Row r = sh.createRow(1);
            r.createCell(0).setCellValue("ProdX");
            r.createCell(1).setCellValue("Paquet");
            r.createCell(2).setCellValue(12);

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            wb.write(out);
            org.springframework.mock.web.MockMultipartFile mf = new org.springframework.mock.web.MockMultipartFile("file", "p.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());

            com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
            com.smboutique.api.model.Boutique bb = new com.smboutique.api.model.Boutique(); bb.setId(55L); u.setBoutique(bb);

            when(uniteService.createIfNotExistsForBoutique(org.mockito.Mockito.eq(55L), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString(), org.mockito.Mockito.nullable(String.class)))
                    .thenAnswer(inv -> { com.smboutique.api.model.Unite uu = new com.smboutique.api.model.Unite(); uu.setId(77L); uu.setLibelle("Paquet"); return uu; });
            org.mockito.Mockito.lenient().when(produitRepository.save(any(Produit.class))).thenAnswer(inv -> { Produit p = inv.getArgument(0); p.setId(500L); return p; });
            when(boutiqueRepository.findById(55L)).thenReturn(java.util.Optional.of(bb));

            // give the current user the UNITE_CREER permission
            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UNITE_CREER");
            u.setPermissions(java.util.Set.of(perm));

            com.smboutique.api.dto.ImportResult res = produitService.importFromExcel(mf, u, true);
            assertEquals(1, res.getProcessedCount());
            // verify unit creation was requested on the UniteService
            org.mockito.Mockito.verify(uniteService, org.mockito.Mockito.times(1)).createIfNotExistsForBoutique(org.mockito.Mockito.eq(55L), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString(), org.mockito.Mockito.nullable(String.class));
        }
    }

    @Test
    public void import_rejects_unit_creation_when_no_permission() throws Exception {
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.ss.usermodel.Sheet sh = wb.createSheet();
            org.apache.poi.ss.usermodel.Row h = sh.createRow(0);
            h.createCell(0).setCellValue("nomProduit");
            h.createCell(1).setCellValue("unite_name");
            h.createCell(2).setCellValue("nombreUnitesParConditionnement");
            org.apache.poi.ss.usermodel.Row r = sh.createRow(1);
            r.createCell(0).setCellValue("ProdX");
            r.createCell(1).setCellValue("Paquet");
            r.createCell(2).setCellValue(12);

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            wb.write(out);
            org.springframework.mock.web.MockMultipartFile mf = new org.springframework.mock.web.MockMultipartFile("file", "p.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());

            com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
            com.smboutique.api.model.Boutique bb = new com.smboutique.api.model.Boutique(); bb.setId(55L); u.setBoutique(bb);

            when(uniteService.findByBoutiqueIdAndLibelleIgnoreCase(55L, "Paquet")).thenReturn(java.util.Optional.empty());

            // user has no UNITE_CREER permission
            u.setPermissions(java.util.Collections.emptySet());

            org.junit.jupiter.api.Assertions.assertThrows(com.smboutique.api.exception.ImportValidationException.class, () -> {
                produitService.importFromExcel(mf, u, true);
            });

            org.mockito.Mockito.verify(uniteService, org.mockito.Mockito.never()).createIfNotExistsForBoutique(org.mockito.Mockito.anyLong(), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString(), org.mockito.Mockito.nullable(String.class));
        }
    }

    @Test
    public void import_async_job_reports_progress() throws Exception {
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook wb = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.ss.usermodel.Sheet sh = wb.createSheet();
            org.apache.poi.ss.usermodel.Row h = sh.createRow(0);
            h.createCell(0).setCellValue("nomProduit");
            h.createCell(1).setCellValue("unite_name");
            h.createCell(2).setCellValue("nombreUnitesParConditionnement");
            org.apache.poi.ss.usermodel.Row r1 = sh.createRow(1);
            r1.createCell(0).setCellValue("ProdA");
            r1.createCell(1).setCellValue("Paquet");
            r1.createCell(2).setCellValue(10);
            org.apache.poi.ss.usermodel.Row r2 = sh.createRow(2);
            r2.createCell(0).setCellValue("ProdB");
            r2.createCell(1).setCellValue("Paquet");
            r2.createCell(2).setCellValue(5);

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            wb.write(out);
            org.springframework.mock.web.MockMultipartFile mf = new org.springframework.mock.web.MockMultipartFile("file", "p.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", out.toByteArray());

            com.smboutique.api.model.Utilisateur u = new com.smboutique.api.model.Utilisateur();
            com.smboutique.api.model.Boutique bb = new com.smboutique.api.model.Boutique(); bb.setId(55L); u.setBoutique(bb);

            when(uniteService.createIfNotExistsForBoutique(org.mockito.Mockito.eq(55L), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString(), org.mockito.Mockito.nullable(String.class)))
                    .thenAnswer(inv -> { com.smboutique.api.model.Unite uu = new com.smboutique.api.model.Unite(); uu.setId(77L); uu.setLibelle("Paquet"); return uu; });
            org.mockito.Mockito.lenient().when(produitRepository.save(any(Produit.class))).thenAnswer(inv -> { Produit p = inv.getArgument(0); p.setId((long)(new java.util.Random().nextInt(1000)+1)); return p; });
            when(boutiqueRepository.findById(55L)).thenReturn(java.util.Optional.of(bb));

            com.smboutique.api.model.Permission perm = new com.smboutique.api.model.Permission(); perm.setName("UNITE_CREER");
            u.setPermissions(java.util.Set.of(perm));

            String jobId = produitService.startAsyncImport(mf, u, true);
            assertNotNull(jobId);

            com.smboutique.api.dto.ImportJobStatus status = null;
            long start = System.currentTimeMillis();
            while (System.currentTimeMillis() - start < 3000) {
                status = produitService.getImportJobStatus(jobId);
                if (status != null && status.getState() == com.smboutique.api.dto.ImportJobStatus.State.COMPLETED) break;
                Thread.sleep(100);
            }
            assertNotNull(status);
            assertEquals(com.smboutique.api.dto.ImportJobStatus.State.COMPLETED, status.getState());
            assertEquals(2, status.getProcessedCount());
            assertEquals(100, status.getProgress());
            org.mockito.Mockito.verify(uniteService, org.mockito.Mockito.atLeastOnce()).createIfNotExistsForBoutique(org.mockito.Mockito.eq(55L), org.mockito.Mockito.anyString(), org.mockito.Mockito.anyString(), org.mockito.Mockito.nullable(String.class));
        }
    }
}

