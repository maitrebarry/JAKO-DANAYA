package com.smboutique.api.controller;

import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.security.JwtUtils;
import com.smboutique.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    AuthenticationManager authenticationManager;

    @Autowired
    UtilisateurRepository utilisateurRepository;

    @Autowired
    PasswordEncoder encoder;

    @Autowired
    JwtUtils jwtUtils;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Autowired(required = false)
    private com.smboutique.api.service.MouvementService mouvementService;

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

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

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

            String jwt = jwtUtils.generateJwtToken(authentication);

            List<String> roles = userDetails.getAuthorities().stream()
                    .map(item -> item.getAuthority())
                    .collect(Collectors.toList());

            try {
                // audit connexion (if mouvementService is available)
                if (mouvementService != null) {
                    Long uid = userDetails.getId();
                    com.smboutique.api.model.Utilisateur u = utilisateurRepository.findById(uid).orElse(null);
                    Long boutiqueId = u != null && u.getBoutique() != null ? u.getBoutique().getId() : null;
                    mouvementService.log("AUTH", "CONNEXION", "Connexion réussie", null, boutiqueId, null, uid, null);
                }
            } catch (Exception e) { }

            return ResponseEntity.ok(new JwtResponse(jwt,
                    userDetails.getId(),
                    userDetails.getUsername(),
                    roles));

        } catch (org.springframework.security.authentication.BadCredentialsException ex) {
            // Return a French message for bad credentials
            Map<String, Object> body = new HashMap<>();
            body.put("status", 401);
            body.put("error", "Non autorisé");
            body.put("message", "Identifiants incorrects");
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
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Utilisateur utilisateur = resolveAuthenticatedUser();
        return ResponseEntity.ok(buildProfileResponse(utilisateur));
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
            return ResponseEntity.ok(Map.of("avatar", publicPath));
        } catch (Exception ex) {
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

        public JwtResponse(String accessToken, Long id, String email, List<String> roles) {
            this.token = accessToken;
            this.id = id;
            this.email = email;
            this.roles = roles;
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
    }
}