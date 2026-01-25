package com.smboutique.api.controller;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

import java.io.IOException;

/**
 * Backwards-compatibility helper: forward legacy /auth/* requests to /api/auth/*
 *
 * Rationale:
 * - Some deployments or external links call /auth/login (no /api prefix).
 * - Static hosting/runtime config mistakes previously caused the frontend to call /auth/*
 * - Forwarding server-side preserves original HTTP method and body and ensures CORS
 *   and security filters are applied consistently by the application.
 */
@Controller
public class LegacyAuthForwardController {

    private static final Logger logger = LoggerFactory.getLogger(LegacyAuthForwardController.class);

    @RequestMapping("/auth/**")
    public void forwardAuth(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        String uri = request.getRequestURI(); // e.g. /auth/login
        String context = request.getContextPath();
        String path = uri.substring(context.length());
        String target = "/api" + path; // /api/auth/login
        logger.debug("Forwarding legacy auth request [{}] -> [{}]", path, target);
        request.getRequestDispatcher(target).forward(request, response);
    }
}
