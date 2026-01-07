package com.smboutique.api.config;

import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.core.JsonGenerator;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import com.smboutique.api.util.DateUtils;

@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Bean
    public Jackson2ObjectMapperBuilder jacksonBuilder() {
        Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder();
        builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        // Custom serializer for LocalDateTime: serialize as ISO_OFFSET_DATE_TIME using Africa/Dakar timezone
        builder.serializerByType(LocalDateTime.class, new StdSerializer<LocalDateTime>(LocalDateTime.class) {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializerProvider provider) throws IOException {
                if (value == null) {
                    gen.writeNull();
                    return;
                }
                ZonedDateTime zdt = value.atZone(DateUtils.DAKAR);
                String s = zdt.format(ISO_OFFSET);
                gen.writeString(s);
            }
        });

        return builder;
    }
}
