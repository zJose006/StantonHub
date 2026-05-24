CREATE DATABASE IF NOT EXISTS stanton_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE stanton_hub;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS content_images;
DROP TABLE IF EXISTS content_items;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS uex_vehicle_cache;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS app_settings;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role VARCHAR(40) NOT NULL DEFAULT 'Farmeo',
  password_hash VARCHAR(255) NOT NULL,
  discord_id VARCHAR(32) NULL UNIQUE,
  discord_avatar_hash VARCHAR(80) NULL,
  discord_avatar VARCHAR(160) NULL,
  auth_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE content_items (
  id CHAR(36) PRIMARY KEY,
  section ENUM('forum', 'guides', 'news') NOT NULL,
  title VARCHAR(140) NOT NULL,
  content TEXT NOT NULL,
  content_html MEDIUMTEXT NULL,
  author_user_id CHAR(36) NULL,
  author_name VARCHAR(80) NOT NULL DEFAULT 'Stanton Hub',
  published_label VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_content_author
    FOREIGN KEY (author_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_content_section_created (section, created_at),
  INDEX idx_content_author (author_user_id)
) ENGINE=InnoDB;

CREATE TABLE content_images (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  content_id CHAR(36) NOT NULL,
  image_name VARCHAR(180) NOT NULL,
  image_src MEDIUMTEXT NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_images_content
    FOREIGN KEY (content_id) REFERENCES content_items(id)
    ON DELETE CASCADE,
  INDEX idx_images_content (content_id, sort_order)
) ENGINE=InnoDB;

CREATE TABLE votes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  content_id CHAR(36) NOT NULL,
  voter_key VARCHAR(120) NOT NULL,
  vote_value TINYINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_votes_content
    FOREIGN KEY (content_id) REFERENCES content_items(id)
    ON DELETE CASCADE,
  CONSTRAINT chk_vote_value CHECK (vote_value IN (-1, 1)),
  UNIQUE KEY uq_vote_content_voter (content_id, voter_key),
  INDEX idx_votes_content (content_id)
) ENGINE=InnoDB;

CREATE TABLE comments (
  id CHAR(36) PRIMARY KEY,
  content_id CHAR(36) NOT NULL,
  author_user_id CHAR(36) NULL,
  author_name VARCHAR(80) NOT NULL DEFAULT 'Modo pruebas',
  comment_text VARCHAR(500) NOT NULL,
  published_label VARCHAR(80) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_content
    FOREIGN KEY (content_id) REFERENCES content_items(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_author
    FOREIGN KEY (author_user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  INDEX idx_comments_content_created (content_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE app_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE uex_vehicle_cache (
  id INT UNSIGNED PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  manufacturer VARCHAR(120) NOT NULL,
  pad_type VARCHAR(40) NULL,
  length_m DECIMAL(10,2) NOT NULL DEFAULT 0,
  scu INT UNSIGNED NOT NULL DEFAULT 0,
  pledge_price INT UNSIGNED NULL,
  purchase_price INT UNSIGNED NULL,
  rental_price INT UNSIGNED NULL,
  is_concept TINYINT(1) NOT NULL DEFAULT 0,
  vehicle_json MEDIUMTEXT NOT NULL,
  raw_vehicle_json MEDIUMTEXT NULL,
  wiki_vehicle_json MEDIUMTEXT NULL,
  combat_json MEDIUMTEXT NULL,
  pledge_json MEDIUMTEXT NULL,
  purchase_json MEDIUMTEXT NULL,
  rental_json MEDIUMTEXT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details_synced_at DATETIME NULL,
  INDEX idx_uex_vehicle_name (name),
  INDEX idx_uex_vehicle_size (length_m, is_concept),
  INDEX idx_uex_vehicle_manufacturer (manufacturer)
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('vehicles_synced_at', '');

CREATE OR REPLACE VIEW content_with_stats AS
SELECT
  content_items.id,
  content_items.section,
  content_items.title,
  content_items.content,
  content_items.content_html,
  content_items.author_user_id,
  content_items.author_name,
  content_items.published_label,
  content_items.created_at,
  COALESCE(SUM(CASE WHEN votes.vote_value = 1 THEN 1 ELSE 0 END), 0) AS up_votes,
  COALESCE(SUM(CASE WHEN votes.vote_value = -1 THEN 1 ELSE 0 END), 0) AS down_votes,
  COUNT(DISTINCT comments.id) AS comment_count
FROM content_items
LEFT JOIN votes ON votes.content_id = content_items.id
LEFT JOIN comments ON comments.content_id = content_items.id
GROUP BY
  content_items.id,
  content_items.section,
  content_items.title,
  content_items.content,
  content_items.content_html,
  content_items.author_user_id,
  content_items.author_name,
  content_items.published_label,
  content_items.created_at;
