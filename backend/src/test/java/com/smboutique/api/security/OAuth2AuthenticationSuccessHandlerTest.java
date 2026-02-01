package com.smboutique.api.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
public class OAuth2AuthenticationSuccessHandlerTest {

    @Autowired
    private OAuth2AuthenticationSuccessHandler handler;

    @Test
    void unknownEmail_shouldBeRejectedWithNotAuthorizedError() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest();
        MockHttpServletResponse res = new MockHttpServletResponse();

        // Build a fake OAuth2User with an email that does not exist in DB
        Map<String, Object> attrs = Map.of("email", "unknown-oauth-user@example.com", "name", "Unknown User");
        OAuth2User user = new DefaultOAuth2User(Collections.emptyList(), attrs, "email");
        Authentication auth = new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());

        handler.onAuthenticationSuccess(req, res, auth);

        String redirected = res.getRedirectedUrl();
        assertThat(redirected).isNotNull();
        assertThat(redirected).contains("error=not_authorized");
    }
}
