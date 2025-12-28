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

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    String shortToken = jwt.length() > 10 ? jwt.substring(0,10) + "..." : jwt;
                    log.warn("JWT validation failed for request {} {} - tokenStartsWith={} - reason={}", request.getMethod(), request.getRequestURI(), shortToken, reason);
                }
            } else {
                logger.debug("Authorization header missing or not a Bearer token for request " + request.getMethod() + " " + request.getRequestURI());
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