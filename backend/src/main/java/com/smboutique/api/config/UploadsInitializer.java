package com.smboutique.api.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.PosixFilePermission;
import java.util.List;
import java.util.Set;

@Component
public class UploadsInitializer {

    private static final Logger logger = LoggerFactory.getLogger(UploadsInitializer.class);

    @Value("${app.upload.dir:./uploads/}")
    private String uploadDir;

    @PostConstruct
    public void ensureUploadDirectories() {
        try {
            Path base = Paths.get(uploadDir).toAbsolutePath().normalize();
            Files.createDirectories(base);
            List<String> subs = List.of("user_photo", "products", "logos", "model_photo");
            for (String s : subs) {
                Path p = base.resolve(s);
                if (!Files.exists(p)) {
                    Files.createDirectories(p);
                    logger.info("Created uploads directory: {}", p.toAbsolutePath().toString());
                }
                // attempt to set owner-write permission on POSIX systems
                try {
                    Set<PosixFilePermission> perms = Files.getPosixFilePermissions(p);
                    if (!perms.contains(PosixFilePermission.OWNER_WRITE)) {
                        perms.add(PosixFilePermission.OWNER_WRITE);
                        Files.setPosixFilePermissions(p, perms);
                        logger.info("Adjusted permissions for {}", p.toAbsolutePath().toString());
                    }
                } catch (UnsupportedOperationException ignore) {
                    // Filesystem doesn't support POSIX permissions (Windows, etc.) - ignore
                } catch (Exception ex) {
                    logger.warn("Failed to adjust permissions for {}: {}", p.toAbsolutePath().toString(), ex.getMessage());
                }
            }
            logger.info("Uploads base directory ready: {}", base.toAbsolutePath().toString());
        } catch (Exception e) {
            logger.error("Unable to ensure upload directories at {}: {}", uploadDir, e.getMessage(), e);
        }
    }
}
