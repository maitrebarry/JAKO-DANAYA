package com.smboutique.api.service.impl;

import com.smboutique.api.service.PdfService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
public class ReceptionPdfIntegrationTest {

    @Autowired
    private PdfService pdfService;

    @Test
    public void generateReception3Pdf_doesNotThrow() throws Exception {
        MockHttpServletResponse res = new MockHttpServletResponse();
        // Call with an existing reception id 3
        pdfService.writeReceptionPdf(3L, res);
        // ensure status is not error
        int status = res.getStatus();
        assertTrue(status == 0 || status == 200 || status == 201, "Unexpected HTTP status: " + status);
        // if body present, length > 0 when successful
        if (res.getContentLength() > 0) {
            assertTrue(res.getContentAsByteArray().length > 0);
        }
    }
}
