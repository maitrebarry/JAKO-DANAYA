package com.smboutique.api.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoginAttemptServiceTest {

    @Test
    void locksOnFifthFailureForThreeMinutes() {
        LoginAttemptService service = new LoginAttemptService();

        for (int attempt = 1; attempt < LoginAttemptService.MAX_ATTEMPTS; attempt++) {
            LoginAttemptService.AttemptStatus status =
                    service.registerFailure(" User@Example.com ");
            assertFalse(status.locked());
            assertEquals(LoginAttemptService.MAX_ATTEMPTS - attempt, status.remainingAttempts());
        }

        LoginAttemptService.AttemptStatus locked =
                service.registerFailure("user@example.com");

        assertTrue(locked.locked());
        assertEquals(0, locked.remainingAttempts());
        assertTrue(locked.retryAfterSeconds() > 0);
        assertTrue(locked.retryAfterSeconds() <= 180);
        assertTrue(service.status("USER@example.com").locked());
    }

    @Test
    void successfulLoginClearsFailures() {
        LoginAttemptService service = new LoginAttemptService();
        service.registerFailure("user@example.com");
        service.registerFailure("user@example.com");

        service.registerSuccess("USER@example.com");

        LoginAttemptService.AttemptStatus status = service.status("user@example.com");
        assertFalse(status.locked());
        assertEquals(0, status.failedAttempts());
        assertEquals(LoginAttemptService.MAX_ATTEMPTS, status.remainingAttempts());
    }
}
