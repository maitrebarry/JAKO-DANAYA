package com.smboutique.api.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class SubscriptionAccessFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;

    @Value("${app.subscription.enforcement-enabled:false}")
    private boolean enforcementEnabled;

    public SubscriptionAccessFilter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null) return true;
        if (!uri.startsWith("/api/")) return true;
        return uri.startsWith("/api/auth/")
                || uri.startsWith("/api/public/")
                || uri.startsWith("/api/uploads/")
                || uri.startsWith("/api/subscription/")
                || uri.startsWith("/api/admin/subscriptions/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!enforcementEnabled) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            filterChain.doFilter(request, response);
            return;
        }

        boolean isSuperAdmin = auth.getAuthorities() != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> "ROLE_SUPERADMIN".equalsIgnoreCase(a) || "SUPERADMIN".equalsIgnoreCase(a));
        if (isSuperAdmin) {
            filterChain.doFilter(request, response);
            return;
        }

        String username = auth.getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    "SELECT ab.statut, ab.date_fin, ab.grace_end_at, b.nom AS boutique_nom " +
                            "FROM utilisateur u " +
                            "LEFT JOIN boutique b ON b.id_boutique = u.boutique_id " +
                        "LEFT JOIN LATERAL (SELECT ab1.* FROM abonnement_boutique ab1 WHERE ab1.boutique_id = u.boutique_id ORDER BY ab1.id DESC LIMIT 1) ab ON TRUE " +
                            "WHERE lower(u.email) = lower(?) " +
                            "LIMIT 1",
                    username
            );

            if (rows.isEmpty()) {
                filterChain.doFilter(request, response);
                return;
            }

            Map<String, Object> row = rows.get(0);
            String statut = row.get("statut") != null ? String.valueOf(row.get("statut")) : null;
            Timestamp dateFinTs = (Timestamp) row.get("date_fin");
            Timestamp graceEndTs = (Timestamp) row.get("grace_end_at");

            // No subscription configured yet => do not block existing boutiques.
            if (statut == null && dateFinTs == null) {
                filterChain.doFilter(request, response);
                return;
            }

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime dateFin = dateFinTs != null ? dateFinTs.toLocalDateTime() : null;
            LocalDateTime graceEnd = graceEndTs != null ? graceEndTs.toLocalDateTime() : null;

            boolean hardStatusBlocked = "EXPIRED".equalsIgnoreCase(statut)
                    || "PAST_DUE".equalsIgnoreCase(statut)
                    || "CANCELED".equalsIgnoreCase(statut);

            boolean dateBlocked = dateFin != null && now.isAfter(dateFin)
                    && (graceEnd == null || now.isAfter(graceEnd));

            if (hardStatusBlocked || dateBlocked) {
                response.setStatus(402);
                response.setContentType("application/json;charset=UTF-8");
                Map<String, Object> body = new HashMap<>();
                body.put("error", "Abonnement expiré");
                body.put("message", "Votre abonnement a expiré. Veuillez renouveler pour continuer.");
                body.put("path", request.getRequestURI());
                new ObjectMapper().writeValue(response.getWriter(), body);
                return;
            }

        } catch (DataAccessException ex) {
            // If subscription tables are not initialized, keep legacy behavior.
        }

        filterChain.doFilter(request, response);
    }
}
