package com.smboutique.api.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-side login throttling. The frontend mirrors the lock for usability,
 * but this service remains authoritative and cannot be bypassed from React.
 */
@Service
public class LoginAttemptService {

    public static final int MAX_ATTEMPTS = 5;
    public static final Duration LOCK_DURATION = Duration.ofMinutes(3);

    private final ConcurrentHashMap<String, AttemptState> attempts = new ConcurrentHashMap<>();

    public AttemptStatus status(String email) {
        String key = normalize(email);
        AttemptState state = attempts.get(key);
        if (state == null) {
            return new AttemptStatus(false, 0, MAX_ATTEMPTS, 0);
        }

        synchronized (state) {
            if (state.lockedUntil != null) {
                long remaining = secondsUntil(state.lockedUntil);
                if (remaining > 0) {
                    return new AttemptStatus(true, state.failures, 0, remaining);
                }
                attempts.remove(key, state);
                return new AttemptStatus(false, 0, MAX_ATTEMPTS, 0);
            }
            return new AttemptStatus(false, state.failures,
                    Math.max(0, MAX_ATTEMPTS - state.failures), 0);
        }
    }

    public AttemptStatus registerFailure(String email) {
        String key = normalize(email);
        AttemptState state = attempts.computeIfAbsent(key, ignored -> new AttemptState());

        synchronized (state) {
            if (state.lockedUntil != null) {
                long remaining = secondsUntil(state.lockedUntil);
                if (remaining > 0) {
                    return new AttemptStatus(true, state.failures, 0, remaining);
                }
                state.failures = 0;
                state.lockedUntil = null;
            }

            state.failures++;
            if (state.failures >= MAX_ATTEMPTS) {
                state.lockedUntil = Instant.now().plus(LOCK_DURATION);
                return new AttemptStatus(true, state.failures, 0, LOCK_DURATION.toSeconds());
            }

            return new AttemptStatus(false, state.failures,
                    MAX_ATTEMPTS - state.failures, 0);
        }
    }

    public void registerSuccess(String email) {
        attempts.remove(normalize(email));
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private long secondsUntil(Instant lockedUntil) {
        return Math.max(0, Duration.between(Instant.now(), lockedUntil).toSeconds() + 1);
    }

    private static final class AttemptState {
        private int failures;
        private Instant lockedUntil;
    }

    public record AttemptStatus(
            boolean locked,
            int failedAttempts,
            int remainingAttempts,
            long retryAfterSeconds
    ) {}
}
