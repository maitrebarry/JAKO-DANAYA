package com.smboutique.api.security;

import com.smboutique.api.repository.UtilisateurRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class AuthTokenFilter extends OncePerRequestFilter {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuthTokenFilter.class);

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private UtilisateurRepository utilisateurRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String headerAuth = request.getHeader("Authorization");
            boolean hasAuthHeader = headerAuth != null && !headerAuth.isEmpty();
            boolean startsWithBearer = hasAuthHeader && headerAuth.startsWith("Bearer ");
            // Log header presence and shape (no token content) to help diagnose missing/invalid header problems
            log.info("Incoming request: {} {} - Authorization present? {} - startsWithBearer? {}", request.getMethod(), request.getRequestURI(), hasAuthHeader, startsWithBearer);

            String jwt = parseJwt(request);
            if (jwt != null) {
                String reason = jwtUtils.validateJwtTokenWithMessage(jwt);
                if (reason == null) {
                    String username = jwtUtils.getUserNameFromJwtToken(jwt);

                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // Check that the user account is enabled before accepting the token
                    if (!userDetails.isEnabled()) {
                        String shortToken = jwt.length() > 10 ? jwt.substring(0,10) + "..." : jwt;
                        log.warn("Rejected authentication for disabled user on request {} {} - user={} - tokenStartsWith={}", request.getMethod(), request.getRequestURI(), username, shortToken);
                        // Respond with 403 Forbidden to indicate the account is disabled
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json;charset=UTF-8");
                        String body = String.format("{\"error\":\"Compte désactivé\",\"message\":\"L'utilisateur est désactivé\"}");
                        response.getWriter().write(body);
                        return;
                    }

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    // Log successful authentication for diagnostics (do not log full token)
                    String shortToken = jwt.length() > 10 ? jwt.substring(0,10) + "..." : jwt;
                    log.info("Authenticated request {} {} - user={} - tokenStartsWith={}", request.getMethod(), request.getRequestURI(), username, shortToken);
                    try {
                        // Show granted authorities for debugging (no sensitive data)
                        java.util.Collection<?> auths = userDetails.getAuthorities();
                        log.debug("User {} authorities: {}", username, auths);
                    } catch (Exception ignore) {}
                } else {
                    String shortToken = jwt.length() > 10 ? jwt.substring(0,10) + "..." : jwt;
                    log.warn("JWT validation failed for request {} {} - tokenStartsWith={} - reason={}", request.getMethod(), request.getRequestURI(), shortToken, reason);
                }
            } else {
                // If a document endpoint is requested without a Bearer header, log at WARN to help diagnose 401s seen by users
                String uri = request.getRequestURI();
                if ((uri != null && uri.startsWith("/api/documents")) && (headerAuth == null || !headerAuth.startsWith("Bearer ")) && !"OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    log.warn("Document endpoint requested without Bearer Authorization header: {} {}", request.getMethod(), uri);
                } else {
                    logger.debug("Authorization header missing or not a Bearer token for request " + request.getMethod() + " " + uri);
                }
            }
        } catch (Exception e) {
            logger.error("Cannot set user authentication", e);
        }

        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        return null;
    }
}