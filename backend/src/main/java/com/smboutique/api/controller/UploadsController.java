package com.smboutique.api.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.net.MalformedURLException;
import org.springframework.core.io.UrlResource;

import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaTypeFactory;

@RestController
public class UploadsController {

    private static final Logger logger = LoggerFactory.getLogger(UploadsController.class);

    @Value("${app.upload.user-photo-dir:./uploads/user_photo/}")
    private String userPhotoDir;

    @Value("${app.upload.dir:./uploads/}")
    private String uploadDir;

    @GetMapping("/uploads/user_photo/{filename:.+}")
    public ResponseEntity<Resource> serveUserPhoto(@PathVariable String filename) {
        if (!StringUtils.hasText(filename)) {
            return serveDefaultAvatar();
        }

        try {
            Path dir = Paths.get(userPhotoDir).toAbsolutePath().normalize();
            Path file = dir.resolve(filename).normalize();

            // Prevent path traversal
            if (!file.startsWith(dir) || !Files.exists(file) || !Files.isReadable(file)) {
                logger.debug("Avatar not found, serving default - requested: {} (resolved: {})", filename, file.toString());
                return serveDefaultAvatar();
            }

            UrlResource resource = new UrlResource(file.toUri());
            Optional<MediaType> mt = MediaTypeFactory.getMediaType(filename);
            return ResponseEntity.ok()
                    .contentType(mt.orElse(MediaType.APPLICATION_OCTET_STREAM))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            logger.warn("Malformed URL while serving avatar {}: {}", filename, e.getMessage());
            return serveDefaultAvatar();
        } catch (Exception e) {
            logger.error("Error while serving avatar {}: {}", filename, e.getMessage());
            return serveDefaultAvatar();
        }
    }

    @GetMapping("/api/uploads/products/{filename:.+}")
    public ResponseEntity<Resource> serveProductImage(@PathVariable String filename) {
        if (!StringUtils.hasText(filename)) {
            return ResponseEntity.notFound().build();
        }

        try {
            Path dir = Paths.get(uploadDir).toAbsolutePath().normalize().resolve("products");
            Path file = dir.resolve(filename).normalize();

            if (!file.startsWith(dir) || !Files.exists(file) || !Files.isReadable(file)) {
                // Fallback: try mounted path /app/uploads/products (Render disk mount)
                try {
                    Path fallbackDir = Paths.get("/app/uploads/products").toAbsolutePath().normalize();
                    Path fb = fallbackDir.resolve(filename).normalize();
                    if (Files.exists(fb) && Files.isReadable(fb)) {
                        logger.info("Product image served from fallback path: {}", fb.toString());
                        UrlResource resource = new UrlResource(fb.toUri());
                        Optional<MediaType> mt = MediaTypeFactory.getMediaType(filename);
                        return ResponseEntity.ok()
                                .contentType(mt.orElse(MediaType.APPLICATION_OCTET_STREAM))
                                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                                .body(resource);
                    }
                } catch (Exception ex) {
                    logger.warn("Fallback product image check failed: {}", ex.getMessage());
                }

                logger.debug("Product image not found - requested: {} (resolved: {})", filename, file.toString());
                return ResponseEntity.notFound().build();
            }

            UrlResource resource = new UrlResource(file.toUri());
            Optional<MediaType> mt = MediaTypeFactory.getMediaType(filename);
            return ResponseEntity.ok()
                    .contentType(mt.orElse(MediaType.APPLICATION_OCTET_STREAM))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            logger.warn("Malformed URL while serving product image {}: {}", filename, e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            logger.error("Error while serving product image {}: {}", filename, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    private ResponseEntity<Resource> serveDefaultAvatar() {
        try {
            Resource defaultRes = new ClassPathResource("static/assets/images/avatar.svg");
            if (!defaultRes.exists()) {
                // fallback to built-in placeholder (empty SVG)
                String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'></svg>";
                Resource r = new org.springframework.core.io.ByteArrayResource(svg.getBytes());
                return ResponseEntity.ok().contentType(MediaType.valueOf("image/svg+xml")).body(r);
            }
            return ResponseEntity.ok().contentType(MediaType.valueOf("image/svg+xml")).body(defaultRes);
        } catch (Exception e) {
            logger.warn("Failed to load default avatar resource: {}", e.getMessage());
            String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'></svg>";
            Resource r = new org.springframework.core.io.ByteArrayResource(svg.getBytes());
            return ResponseEntity.ok().contentType(MediaType.valueOf("image/svg+xml")).body(r);
        }
    }
}
