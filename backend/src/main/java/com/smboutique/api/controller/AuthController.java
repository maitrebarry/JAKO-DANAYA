package com.smboutique.api.controller;

import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.security.JwtUtils;
import com.smboutique.api.security.UserDetailsImpl;
import com.smboutique.api.security.LoginAttemptService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.sql.Timestamp;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UtilisateurRepository utilisateurRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired
    LoginAttemptService loginAttemptService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired(required = false)
    private com.smboutique.api.service.MouvementService mouvementService;

    @Autowired(required = false)
    private JdbcTemplate jdbcTemplate;

    private boolean isSuperAdmin(Utilisateur u) {
        return u != null && u.getRoles() != null && u.getRoles().stream()
                .anyMatch(r -> "SUPERADMIN".equalsIgnoreCase(r.getName()) || "ROLE_SUPERADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean isSubscriptionBlocked(Utilisateur u) {
        if (u == null || u.getBoutique() == null || jdbcTemplate == null) return false;
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT statut, date_fin, grace_end_at FROM abonnement_boutique WHERE boutique_id = ? ORDER BY id DESC LIMIT 1",
                    u.getBoutique().getId()
            );
            if (rows.isEmpty()) return false; // backward-compatible if no subscription row yet

            Map<String, Object> row = rows.get(0);
            String statut = row.get("statut") != null ? String.valueOf(row.get("statut")) : null;
            Timestamp dateFinTs = (Timestamp) row.get("date_fin");
            Timestamp graceEndTs = (Timestamp) row.get("grace_end_at");

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime dateFin = dateFinTs != null ? dateFinTs.toLocalDateTime() : null;
            LocalDateTime graceEnd = graceEndTs != null ? graceEndTs.toLocalDateTime() : null;

            boolean hardStatusBlocked = "EXPIRED".equalsIgnoreCase(statut)
                    || "PAST_DUE".equalsIgnoreCase(statut)
                    || "CANCELED".equalsIgnoreCase(statut);
            boolean dateBlocked = dateFin != null && now.isAfter(dateFin)
                    && (graceEnd == null || now.isAfter(graceEnd));

            return hardStatusBlocked || dateBlocked;
        } catch (DataAccessException ex) {
            // Tables not initialized => do not block legacy login flow.
            return false;
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        // Validation des champs et messages d'erreur en français
        if (loginRequest.getEmail() == null || loginRequest.getEmail().isBlank() || loginRequest.getPassword() == null || loginRequest.getPassword().isBlank()) {
            Map<String, Object> body = new HashMap<>();
            body.put("status", 400);
            body.put("error", "Requête invalide");
            body.put("message", "L'email et le mot de passe sont requis");
            return ResponseEntity.badRequest().body(body);
        }

        LoginAttemptService.AttemptStatus attemptStatus =
                loginAttemptService.status(loginRequest.getEmail());
        if (attemptStatus.locked()) {
            return lockedLoginResponse(attemptStatus);
        }

        try {
            logger.info("Attempting authentication for email={}", loginRequest != null ? loginRequest.getEmail() : null);
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

            loginAttemptService.registerSuccess(loginRequest.getEmail());
            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();

            // Deny login if account is disabled
            if (!userDetails.isEnabled()) {
                Map<String, Object> body = new HashMap<>();
                body.put("status", 403);
                body.put("error", "Forbidden");
                body.put("message", "Compte désactivé");
                return ResponseEntity.status(403).body(body);
            }

            Utilisateur u = utilisateurRepository.findById(userDetails.getId()).orElse(null);
            boolean subscriptionBlocked = !isSuperAdmin(u) && isSubscriptionBlocked(u);

            String jwt = jwtUtils.generateJwtToken(authentication);

            List<String> roles = userDetails.getAuthorities().stream()
                    .map(item -> item.getAuthority())
                    .collect(Collectors.toList());

            try {
                Utilisateur u2 = utilisateurRepository.findById(userDetails.getId()).orElse(null);
                if (u2 != null) {
                    LocalDateTime now = LocalDateTime.now();
                    u2.setLastLoginAt(now);
                    u2.setLastSeenAt(now);
                    utilisateurRepository.save(u2);
                }
            } catch (Exception ignored) {}

            try {
                // audit connexion (if mouvementService is available)
                if (mouvementService != null) {
                    Long uid = userDetails.getId();
                    com.smboutique.api.model.Utilisateur ua = utilisateurRepository.findById(uid).orElse(null);
                    Long boutiqueId = ua != null && ua.getBoutique() != null ? ua.getBoutique().getId() : null;
                    mouvementService.log("AUTH", "CONNEXION", "Connexion réussie", null, boutiqueId, null, uid, null);
                }
            } catch (Exception e) { }

                return ResponseEntity.ok(new JwtResponse(jwt,
                    userDetails.getId(),
                    userDetails.getUsername(),
                    roles,
                    subscriptionBlocked,
                    subscriptionBlocked ? "Votre abonnement a expiré. Veuillez vous réabonner pour accéder à l'application." : null));

        } catch (org.springframework.security.authentication.BadCredentialsException ex) {
            logger.warn("Bad credentials for email={}", loginRequest != null ? loginRequest.getEmail() : null);
            LoginAttemptService.AttemptStatus failureStatus =
                    loginAttemptService.registerFailure(loginRequest.getEmail());
            if (failureStatus.locked()) {
                return lockedLoginResponse(failureStatus);
            }
            // Return a French message for bad credentials
            Map<String, Object> body = new HashMap<>();
            body.put("status", 401);
            body.put("error", "Non autorisé");
            body.put("message", "Identifiants incorrects");
            body.put("remainingAttempts", failureStatus.remainingAttempts());
            return ResponseEntity.status(401).body(body);
        } catch (org.springframework.security.authentication.DisabledException ex) {
            Map<String, Object> body = new HashMap<>();
            body.put("status", 403);
            body.put("error", "Compte désactivé");
            body.put("message", "Votre compte a été désactivé, veuillez contacter un administrateur");
            return ResponseEntity.status(403).body(body);
        } catch (org.springframework.security.core.AuthenticationException ex) {
            Map<String, Object> body = new HashMap<>();
            body.put("status", 401);
            body.put("error", "Non autorisé");
            body.put("message", "Erreur d'authentification");
            return ResponseEntity.status(401).body(body);
        } catch (Throwable ex) {
            logger.error("Unexpected error during authentication for email={}", loginRequest != null ? loginRequest.getEmail() : null, ex);
            Map<String, Object> body = new HashMap<>();
            body.put("status", 500);
            body.put("error", "Internal Server Error");
            body.put("message", "Erreur interne du serveur");
            return ResponseEntity.status(500).body(body);
        }
    }

    private ResponseEntity<Map<String, Object>> lockedLoginResponse(
            LoginAttemptService.AttemptStatus status) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", 429);
        body.put("error", "Trop de tentatives");
        body.put("message", "Trop de tentatives incorrectes. Réessayez dans 3 minutes.");
        body.put("remainingAttempts", 0);
        body.put("retryAfterSeconds", status.retryAfterSeconds());
        return ResponseEntity.status(429)
                .header("Retry-After", String.valueOf(status.retryAfterSeconds()))
                .body(body);
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Utilisateur utilisateur = resolveAuthenticatedUser();
        return ResponseEntity.ok(buildProfileResponse(utilisateur));
    }

    @PostMapping("/ping")
    public ResponseEntity<?> ping() {
        try {
            Utilisateur utilisateur = resolveAuthenticatedUser();
            utilisateur.setLastSeenAt(LocalDateTime.now());
            utilisateurRepository.save(utilisateur);
            return ResponseEntity.ok(Map.of("status", "ok"));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", "Authentication required"));
        }
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateCurrentUser(@RequestBody Map<String, Object> payload) {
        Utilisateur utilisateur = resolveAuthenticatedUser();
        if (payload.containsKey("nom")) utilisateur.setNom((String) payload.get("nom"));
        if (payload.containsKey("prenom")) utilisateur.setPrenom((String) payload.get("prenom"));
        if (payload.containsKey("pseudo")) utilisateur.setPseudo((String) payload.get("pseudo"));
        if (payload.containsKey("contact")) utilisateur.setContact((String) payload.get("contact"));
        if (payload.containsKey("adresse")) utilisateur.setAdresse((String) payload.get("adresse"));
        // Do not allow role/permission escalation through this endpoint
        utilisateurRepository.save(utilisateur);
        return ResponseEntity.ok(buildProfileResponse(utilisateur));
    }

    @PostMapping("/me/password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest req) {
        Utilisateur utilisateur = resolveAuthenticatedUser();
        if (req.getOldPassword() == null || req.getNewPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Les champs oldPassword et newPassword sont requis"));
        }
        if (!encoder.matches(req.getOldPassword(), utilisateur.getMotDePasse())) {
            return ResponseEntity.status(400).body(Map.of("error", "Mot de passe actuel incorrect"));
        }
        utilisateur.setMotDePasse(encoder.encode(req.getNewPassword()));
        utilisateurRepository.save(utilisateur);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @Value("${app.upload.user-photo-dir}")
    private String userPhotoDir;

    @Value("${app.frontend.reset-password-url}")
    private String resetPasswordUrl;

    @PostMapping("/me/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        Utilisateur utilisateur = resolveAuthenticatedUser();
        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Fichier vide"));
        }
        try {
            java.nio.file.Path uploadPath = java.nio.file.Paths.get(userPhotoDir);
            java.nio.file.Files.createDirectories(uploadPath);
            String original = java.util.UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
            java.nio.file.Path dest = uploadPath.resolve(original);
            try (java.io.InputStream in = file.getInputStream()) {
                java.nio.file.Files.copy(in, dest, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            String publicPath = "/uploads/user_photo/" + original;
            utilisateur.setAvatar(publicPath);
            utilisateurRepository.save(utilisateur);
            // Log saved avatar path for debugging in production
            logger.info("Saved avatar for user {} -> {}", utilisateur.getId(), dest.toAbsolutePath().toString());
            return ResponseEntity.ok(Map.of("avatar", publicPath));
        } catch (Exception ex) {
            logger.error("Failed to save avatar for user: {} - error: {}", utilisateur != null ? utilisateur.getId() : null, ex.getMessage(), ex);
            return ResponseEntity.status(500).body(Map.of("error", "Impossible d'enregistrer le fichier"));
        }
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody ForgotPasswordRequest req) {
        if (req.getEmail() == null || req.getEmail().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email requis"));
        }

        utilisateurRepository.findByEmailIgnoreCase(req.getEmail()).ifPresent(u -> {
            String token = java.util.UUID.randomUUID().toString();
            u.setResetToken(token);
            u.setResetTokenExpire(LocalDateTime.now().plusMinutes(30));
            utilisateurRepository.save(u);

            if (mailSender != null) {
                try {
                    String link = resetPasswordUrl + "?token=" + token;
                    SimpleMailMessage msg = new SimpleMailMessage();
                    msg.setTo(u.getEmail());
                    msg.setSubject("Réinitialisation du mot de passe");
                    msg.setText("Cliquez sur ce lien pour réinitialiser votre mot de passe : " + link);
                    mailSender.send(msg);
                } catch (Exception ignored) {}
            }
        });

        // Always return OK to avoid account enumeration
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        if (req.getToken() == null || req.getToken().isBlank() || req.getNewPassword() == null || req.getNewPassword().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Token et nouveau mot de passe requis"));
        }

        Utilisateur utilisateur = utilisateurRepository.findByResetToken(req.getToken()).orElse(null);
        if (utilisateur == null || utilisateur.getResetTokenExpire() == null || utilisateur.getResetTokenExpire().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(400).body(Map.of("error", "Token invalide ou expiré"));
        }

        utilisateur.setMotDePasse(encoder.encode(req.getNewPassword()));
        utilisateur.setResetToken(null);
        utilisateur.setResetTokenExpire(null);
        utilisateurRepository.save(utilisateur);
        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    private Utilisateur resolveAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();
        return utilisateurRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));
    }

    private Map<String, Object> buildProfileResponse(Utilisateur utilisateur) {
        // Aggregate permissions: direct + role-derived
        java.util.Set<String> permissions = new java.util.HashSet<>();
        if (utilisateur.getPermissions() != null) {
            utilisateur.getPermissions().forEach(p -> permissions.add(p.getName()));
        }
        if (utilisateur.getRoles() != null) {
            utilisateur.getRoles().forEach(r -> {
                if (r.getPermissions() != null) {
                    r.getPermissions().forEach(p -> permissions.add(p.getName()));
                }
            });
        }

        Map<String, Object> response = new HashMap<>();
        // Build a safe user map (Map.of doesn't accept null values)
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", utilisateur.getId());
        userMap.put("email", utilisateur.getEmail());
        userMap.put("nom", utilisateur.getNom() != null ? utilisateur.getNom() : "");
        userMap.put("prenom", utilisateur.getPrenom() != null ? utilisateur.getPrenom() : "");
        userMap.put("pseudo", utilisateur.getPseudo() != null ? utilisateur.getPseudo() : "");
        userMap.put("typeUtilisateur", utilisateur.getTypeUtilisateur() != null ? utilisateur.getTypeUtilisateur() : "");
        userMap.put("contact", utilisateur.getContact() != null ? utilisateur.getContact() : "");
        userMap.put("adresse", utilisateur.getAdresse() != null ? utilisateur.getAdresse() : "");
        userMap.put("avatar", utilisateur.getAvatar() != null ? utilisateur.getAvatar() : "");

        response.put("user", userMap);
        response.put("permissions", permissions);
        response.put("roles", utilisateur.getRoles() != null ? utilisateur.getRoles().stream().map(Role::getName).collect(Collectors.toList()) : java.util.List.of());
        if (utilisateur.getBoutique() != null) {
            Map<String, Object> cb = new HashMap<>();
            cb.put("id", utilisateur.getBoutique().getId());
            cb.put("nom", utilisateur.getBoutique().getNom());
            response.put("currentBoutique", cb);
        }
        return response;
    }

    public static class ChangePasswordRequest {
        private String oldPassword;
        private String newPassword;

        public String getOldPassword() {
            return oldPassword;
        }

        public void setOldPassword(String oldPassword) {
            this.oldPassword = oldPassword;
        }

        public String getNewPassword() {
            return newPassword;
        }

        public void setNewPassword(String newPassword) {
            this.newPassword = newPassword;
        }
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(Map.of("status", "unauthenticated"));
        }
        return ResponseEntity.ok(Map.of(
            "status", "authenticated",
            "principal", authentication.getName(),
            "authorities", authentication.getAuthorities()
        ));
    }

    public static class LoginRequest {
        private String email;
        private String password;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public String getPassword() {
            return password;
        }

        public void setPassword(String password) {
            this.password = password;
        }
    }

    public static class ForgotPasswordRequest {
        private String email;

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }
    }

    public static class ResetPasswordRequest {
        private String token;
        private String newPassword;

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getNewPassword() {
            return newPassword;
        }

        public void setNewPassword(String newPassword) {
            this.newPassword = newPassword;
        }
    }

    public static class JwtResponse {
        private String token;
        private String type = "Bearer";
        private Long id;
        private String email;
        private List<String> roles;
        private boolean subscriptionBlocked;
        private String subscriptionMessage;

        public JwtResponse(String accessToken, Long id, String email, List<String> roles) {
            this.token = accessToken;
            this.id = id;
            this.email = email;
            this.roles = roles;
            this.subscriptionBlocked = false;
            this.subscriptionMessage = null;
        }

        public JwtResponse(String accessToken, Long id, String email, List<String> roles, boolean subscriptionBlocked, String subscriptionMessage) {
            this.token = accessToken;
            this.id = id;
            this.email = email;
            this.roles = roles;
            this.subscriptionBlocked = subscriptionBlocked;
            this.subscriptionMessage = subscriptionMessage;
        }

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public List<String> getRoles() {
            return roles;
        }

        public void setRoles(List<String> roles) {
            this.roles = roles;
        }

        public boolean isSubscriptionBlocked() {
            return subscriptionBlocked;
        }

        public void setSubscriptionBlocked(boolean subscriptionBlocked) {
            this.subscriptionBlocked = subscriptionBlocked;
        }

        public String getSubscriptionMessage() {
            return subscriptionMessage;
        }

        public void setSubscriptionMessage(String subscriptionMessage) {
            this.subscriptionMessage = subscriptionMessage;
        }
    }
}
