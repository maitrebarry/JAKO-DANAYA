package com.smboutique.api.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;

@Component
public class JwtUtils {

    private static final Logger logger = LoggerFactory.getLogger(JwtUtils.class);

    @Value("${jwt.secret:votreSecretSuperSecureTresLongAuMoins256BitsChangezEnProduction}")
    private String jwtSecret;

    @Value("${app.jwt.expiration:86400000}") // 24 hours
    private int jwtExpirationMs;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes());
    }

    public String generateJwtToken(Authentication authentication) {
        UserDetails userPrincipal = (UserDetails) authentication.getPrincipal();
        try {
            return Jwts.builder()
                    .setSubject((userPrincipal.getUsername()))
                    .setIssuedAt(new Date())
                    .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                    .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                    .compact();
        } catch (IllegalArgumentException e) {
            // Likely caused by invalid/short jwtSecret
            logger.error("Invalid JWT signing key (length={}), jwt.secret may be misconfigured", jwtSecret != null ? jwtSecret.length() : 0, e);
            throw e;
        } catch (Exception e) {
            logger.error("Unexpected error while generating JWT for user={}", userPrincipal != null ? userPrincipal.getUsername() : null, e);
            throw e;
        }
    }

    public String generateTokenFromUsername(String username) {
        return Jwts.builder()
                .setSubject(username)
                .setIssuedAt(new Date())
                .setExpiration(new Date((new Date()).getTime() + jwtExpirationMs))
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String getUserNameFromJwtToken(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean validateJwtToken(String authToken) {
        return validateJwtTokenWithMessage(authToken) == null;
    }

    /**
     * Validate token and return a reason string if invalid, or null if valid.
     */
    public String validateJwtTokenWithMessage(String authToken) {
        try {
            Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(authToken);
            return null;
        } catch (MalformedJwtException e) {
            logger.warn("Invalid JWT token: {}", e.getMessage());
            return "invalid: " + e.getMessage();
        } catch (ExpiredJwtException e) {
            logger.info("JWT token is expired: {}", e.getMessage());
            return "expired: " + e.getMessage();
        } catch (UnsupportedJwtException e) {
            logger.warn("JWT token is unsupported: {}", e.getMessage());
            return "unsupported: " + e.getMessage();
        } catch (IllegalArgumentException e) {
            logger.warn("JWT claims string is empty: {}", e.getMessage());
            return "empty: " + e.getMessage();
        } catch (Exception e) {
            logger.error("Unexpected JWT validation error: {}", e.getMessage(), e);
            return "error: " + e.getMessage();
        }
    }
}