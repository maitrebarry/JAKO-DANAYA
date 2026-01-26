package com.smboutique.api.security;

import com.smboutique.api.model.Utilisateur;
import com.smboutique.api.repository.RoleRepository;
import com.smboutique.api.repository.UtilisateurRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.util.Optional;
import java.util.Set;

@Component
public class OAuth2AuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Value("${app.oauth2.redirect-uri}")
    private String redirectUri;

    @Value("${app.oauth2.default-role:MANAGER}")
    private String defaultRole;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();
        String email = oAuth2User.getAttribute("email");

        if (email == null || email.isBlank()) {
            String target = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("error", "missing_email")
                .build()
                .toUriString();
            getRedirectStrategy().sendRedirect(request, response, target);
            return;
        }

        Utilisateur utilisateur = utilisateurRepository.findByEmailIgnoreCase(email)
            .orElseGet(() -> createUserFromOAuth(email, oAuth2User));

        if (utilisateur.getStatut() != null && utilisateur.getStatut().equalsIgnoreCase("DESACTIVE")) {
            String target = UriComponentsBuilder.fromUriString(redirectUri)
                .queryParam("error", "account_disabled")
                .build()
                .toUriString();
            getRedirectStrategy().sendRedirect(request, response, target);
            return;
        }

        String token = jwtUtils.generateTokenFromUsername(utilisateur.getEmail());
        String targetUrl = UriComponentsBuilder.fromUriString(redirectUri)
            .queryParam("token", token)
            .queryParam("email", utilisateur.getEmail())
            .build()
            .toUriString();

        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    private Utilisateur createUserFromOAuth(String email, OAuth2User oAuth2User) {
        Utilisateur u = new Utilisateur();
        u.setEmail(email);
        u.setPrenom(Optional.ofNullable(oAuth2User.getAttribute("given_name")).map(Object::toString).orElse(""));
        u.setNom(Optional.ofNullable(oAuth2User.getAttribute("family_name")).map(Object::toString).orElse(""));
        u.setPseudo(Optional.ofNullable(oAuth2User.getAttribute("name")).map(Object::toString).orElse(email));
        u.setMotDePasse(passwordEncoder.encode(java.util.UUID.randomUUID().toString()));
        u.setStatut("ACTIF");
        u.setTypeUtilisateur(defaultRole);

        roleRepository.findByName(defaultRole).ifPresent(role -> u.setRoles(Set.of(role)));
        return utilisateurRepository.save(u);
    }
}