CREATE TABLE IF NOT EXISTS `think_user` (
    `id`      INT(11) UNSIGNED NOT NULL,
    `nick`    VARCHAR(64) NOT NULL,
    `token`   VARCHAR(64) NOT NULL,
    `mobile`  INT(11) UNSIGNED DEFAULT 0,
    `qq`      INT(11) UNSIGNED DEFAULT 0,
    `website` VARCHAR(128) DEFAULT "",
    PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8;
