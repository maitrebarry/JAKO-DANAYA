package com.smboutique.api.controller;

import com.smboutique.api.model.Permission;
import com.smboutique.api.model.Role;
import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.UtilisateurRepository;
import com.smboutique.api.security.JwtUtils;
import com.smboutique.api.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@Valid @RequestBody LoginRequest loginRequest) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        String jwt = jwtUtils.generateJwtToken(authentication);

        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        List<String> roles = userDetails.getAuthorities().stream()
                .map(item -> item.getAuthority())
                .collect(Collectors.toList());

        return ResponseEntity.ok(new JwtResponse(jwt,
                             userDetails.getId(),
                             userDetails.getUsername(),
                             roles));
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String email = authentication.getName();

        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur non trouvé"));

        Set<String> permissions = utilisateur.getPermissions().stream()
                .map(Permission::getName)
                .collect(Collectors.toSet());

        utilisateur.getRoles().forEach(role -> {
            role.getPermissions().forEach(permission -> {
                permissions.add(permission.getName());
            });
        });

        Map<String, Object> response = new HashMap<>();
        response.put("user", Map.of(
            "id", utilisateur.getId(),
            "email", utilisateur.getEmail(),
            "nom", utilisateur.getNom(),
            "prenom", utilisateur.getPrenom(),
            "pseudo", utilisateur.getPseudo(),
            "typeUtilisateur", utilisateur.getTypeUtilisateur()
        ));
        response.put("permissions", permissions);
        response.put("roles", utilisateur.getRoles().stream().map(Role::getName).collect(Collectors.toList()));
        if (utilisateur.getBoutique() != null) {
            response.put("currentBoutique", Map.of(
                "id", utilisateur.getBoutique().getId(),
                "nom", utilisateur.getBoutique().getNom()
            ));
        }

        return ResponseEntity.ok(response);
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