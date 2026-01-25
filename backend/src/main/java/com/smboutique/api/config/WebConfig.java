package com.smboutique.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
@EnableJpaAuditing
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String uploadDir = Paths.get("uploads").toAbsolutePath().toString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + "/");
    }

    // @Override
    // public void addCorsMappings(org.springframework.web.servlet.config.annotation.CorsRegistry registry) {
    //     registry.addMapping("/**")
    //             .allowedOrigins("*")
    //             .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    //             .allowedHeaders("Authorization", "Content-Type", "X-Requested-With", "Accept")
    //             .exposedHeaders("Authorization")
    //             .allowCredentials(false);
    // }
}