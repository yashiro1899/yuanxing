CREATE TABLE IF NOT EXISTS `think_user` (
    `id`         INT(11) UNSIGNED NOT NULL,
    `nick`       VARCHAR(64) NOT NULL,
    `token`      VARCHAR(64) NOT NULL,
    `expires`    BIGINT(13) UNSIGNED NOT NULL,
    `pic_path`   VARCHAR(128) NOT NULL DEFAULT "",
    `guide`      TEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
