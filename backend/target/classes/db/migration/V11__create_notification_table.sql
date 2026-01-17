-- Create notifications table
CREATE TABLE IF NOT EXISTS notification (
    id_notification BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    boutique_id BIGINT,
    type VARCHAR(64) NOT NULL,
    payload TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES utilisateur (id_utilisateur) ON DELETE CASCADE
);

-- index for quick lookup of unread notifications
CREATE INDEX idx_notification_user_read ON notification(user_id, is_read);