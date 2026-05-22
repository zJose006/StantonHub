CREATE DATABASE IF NOT EXISTS stanton_hub
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE stanton_hub;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS content_images;
DROP TABLE IF EXISTS content_items;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS app_settings;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  role VARCHAR(40) NOT NULL DEFAULT 'Farmeo',
  password_hash VARCHAR(255) NOT NULL,
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

INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('session_user_id', ''),
  ('test_bypass', '0');

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
